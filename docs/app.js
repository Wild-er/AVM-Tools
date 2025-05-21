// Dependencies (to be handled by bundler)
const algosdk = require('algosdk');
const multihashes = require('multihashes'); // Using 'multihashes' as specified in prompt
const cid = require('cids');
const axios = require('axios'); // For HTTP requests

// Configuration
const defaultNetwork = 'mainnet'; // Consider making this selectable in HTML later
const ipfsGateway = 'https://ipfs.algonode.dev/ipfs/';

function getIndexerBaseUrl(network) {
  return network === 'mainnet'
    ? 'https://mainnet-idx.4160.nodely.dev'
    : 'https://testnet-idx.4160.nodely.dev';
}

// Event listener for DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    const assetIdInput = document.getElementById('assetIdInput');
    const decodeButton = document.getElementById('decodeButton');
    const ipfsUrlOutput = document.getElementById('ipfsUrlOutput');
    const metadataOutput = document.getElementById('metadataOutput');
    const imageUrlOutput = document.getElementById('imageUrlOutput');
    const errorOutput = document.getElementById('errorOutput');

    decodeButton.addEventListener('click', async () => {
        // Clear previous outputs and errors
        ipfsUrlOutput.textContent = '';
        metadataOutput.textContent = '';
        imageUrlOutput.innerHTML = ''; // Use innerHTML for image tag
        errorOutput.textContent = 'Decoding...'; // Loading message

        const assetId = parseInt(assetIdInput.value);
        if (isNaN(assetId) || assetId <= 0) {
            errorOutput.textContent = 'Please enter a valid positive Asset ID.';
            return;
        }

        try {
            // Note: algosdk.Indexer constructor: token, baseServer, port. Empty string for token and port for default.
            const indexerClient = new algosdk.Indexer('', getIndexerBaseUrl(defaultNetwork), ''); 

            // 1. Fetch Asset Information
            const assetInfo = await indexerClient.lookupAssetByID(assetId).do();
            const assetParams = assetInfo.asset.params;

            if (!assetParams || !assetParams.url || !assetParams.reserve) {
                throw new Error("Asset parameters (URL or Reserve Address) not found. Make sure the Asset ID is correct and the asset conforms to ARC19.");
            }
            
            const encodedUrl = assetParams.url;
            const reserveAddress = assetParams.reserve;

            // 2. Validate ARC19 URL
            const templateRegex = /template-ipfs:\/\/{ipfscid:(\d):([a-z0-9-]+):reserve:([a-z0-9-]+)}/;
            const match = encodedUrl.match(templateRegex);
            if (!match) {
                throw new Error(`Invalid ARC19 URL format: ${encodedUrl}. Expected format: template-ipfs://{ipfscid:(version):(codec):reserve:(hash-type)}`);
            }
            const version = parseInt(match[1]);
            const codecName = match[2];
            const hashTypeName = match[3];

            // 3. Decode Reserve Address
            const reserveBytes = algosdk.decodeAddress(reserveAddress).publicKey;

            // 4. Determine Multihash Type
            const multihashTypeCode = multihashes.names[hashTypeName];
            if (multihashTypeCode === undefined) {
                throw new Error(`Unsupported hash type: ${hashTypeName}`);
            }

            // 5. Encode to Multihash
            const encodedMultihash = multihashes.encode(reserveBytes, multihashTypeCode);
            
            // 6. Construct CID
            let cidInstance;
            if (version === 0) {
                 if (codecName !== 'dag-pb') {
                    console.warn(`CIDv0 with codec '${codecName}' encountered. Standard is 'dag-pb'. Proceeding, but watch for issues.`);
                 }
                 cidInstance = new cid(version, codecName, encodedMultihash);
            } else if (version === 1) {
                cidInstance = new cid(version, codecName, encodedMultihash);
            } else {
                throw new Error(`Unsupported CID version: ${version}`);
            }
            const finalCid = cidInstance.toString();

            // 7. Build Full IPFS URL
            const finalIpfsUrl = `${ipfsGateway}${finalCid}`;

            // 8. Fetch Metadata from IPFS
            let metadata = null;
            let finalImageUrl = null;
            let rawMetadataResponse = null; // To store the raw response for non-JSON cases
            try {
                const ipfsResponse = await axios.get(finalIpfsUrl, { timeout: 10000 }); // 10s timeout
                rawMetadataResponse = ipfsResponse.data;

                if (typeof ipfsResponse.data === 'object' && ipfsResponse.data !== null) {
                    metadata = ipfsResponse.data;
                } else if (typeof ipfsResponse.data === 'string') {
                    try {
                        metadata = JSON.parse(ipfsResponse.data);
                    } catch (e) {
                        // Content is a string but not JSON
                        metadata = { "content": ipfsResponse.data, "warning": "Content from IPFS is not JSON. Displaying as plain text." };
                    }
                } else {
                     // Content is neither object nor string (e.g. boolean, number)
                     metadata = { "content": String(ipfsResponse.data), "warning": "Content from IPFS is not a standard object or string. Displaying as string." };
                }

                // 9. Extract Image URL if metadata has image property
                // Support for 'image' and 'image_url', also direct https links
                if (metadata) {
                    if (typeof metadata.image === 'string' && metadata.image.startsWith('ipfs://')) {
                        const imagePath = metadata.image.replace("ipfs://", "");
                        finalImageUrl = `${ipfsGateway}${imagePath}`;
                    } else if (typeof metadata.image_url === 'string' && metadata.image_url.startsWith('ipfs://')) {
                         const imagePath = metadata.image_url.replace("ipfs://", "");
                        finalImageUrl = `${ipfsGateway}${imagePath}`;
                    } else if (typeof metadata.image === 'string' && metadata.image.startsWith('https://')) {
                        finalImageUrl = metadata.image;
                    } else if (typeof metadata.image_url === 'string' && metadata.image_url.startsWith('https://')) {
                        finalImageUrl = metadata.image_url;
                    }
                }

            } catch (e) {
                const errorMessage = e.response ? `Status ${e.response.status}: ${e.response.statusText}` : e.message;
                console.error("Error fetching metadata from IPFS:", errorMessage, e);
                metadata = { "error": "Could not fetch metadata from IPFS.", "details": errorMessage };
                 if (e.code === 'ECONNABORTED') { // Axios timeout
                    metadata.details = "Request to IPFS gateway timed out.";
                }
            }

            // Display results
            errorOutput.textContent = ''; // Clear "Decoding..."
            ipfsUrlOutput.textContent = `IPFS URL: ${finalIpfsUrl}`;
            
            // Display metadata: prefer parsed JSON, fallback to raw response if parsing failed or was not applicable
            if (typeof metadata === 'object' && metadata !== null) {
                metadataOutput.textContent = JSON.stringify(metadata, null, 2);
            } else if (rawMetadataResponse) { 
                 metadataOutput.textContent = typeof rawMetadataResponse === 'string' ? rawMetadataResponse : JSON.stringify(rawMetadataResponse, null, 2);
                 // Add a warning if we are showing raw data because metadata processing had issues (but not if it was an error already shown in metadata)
                 if (!metadataOutput.textContent.includes("warning") && !metadataOutput.textContent.includes("error")) { 
                    metadataOutput.textContent += "\n\nWarning: Displaying raw response as metadata parsing encountered issues or content was not JSON.";
                 }
            } else {
                metadataOutput.textContent = 'No metadata could be fetched or parsed.';
            }

            if (finalImageUrl) {
                imageUrlOutput.innerHTML = `Image URL: <a href="${finalImageUrl}" target="_blank">${finalImageUrl}</a> <br> <img src="${finalImageUrl}" alt="asset image" style="max-width: 300px; max-height: 300px; border: 1px solid #ccc;">`;
            } else {
                imageUrlOutput.textContent = 'No standard image URL (e.g., ipfs://... or https://...) found in metadata.';
            }

        } catch (err) {
            console.error("Error during decoding process:", err);
            errorOutput.textContent = `Error: ${err.message}`;
            // Clear other fields on error
            ipfsUrlOutput.textContent = '';
            metadataOutput.textContent = '';
            imageUrlOutput.innerHTML = '';
        }
    });
});
