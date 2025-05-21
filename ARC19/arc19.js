const algosdk = require('algosdk');
const multihash = require('multihashes');
const cid = require('cids');
// Axios is still used by algosdk.Indexer, but we'll use fetch for our IPFS call.
// const axios = require('axios'); // Not directly used for IPFS metadata call anymore

// Configuration - Using MainNet for the example
const network = 'mainnet';

// Algod and Indexer Node Configuration (Using Nodely endpoints)
const indexerBaseUrl = network === 'mainnet'
  ? 'https://mainnet-idx.4160.nodely.dev'
  : 'https://testnet-idx.4160.nodely.dev';

const algodBaseUrl = network === 'mainnet'
  ? 'https://mainnet-api.4160.nodely.dev'
  : 'https://testnet-api.4160.nodely.dev';

// IPFS Gateway - Using AlgoNode gateway
const ipfsGateway = 'https://ipfs.algonode.dev/ipfs/';
const ipfsOptimizerParams = '?optimizer=image&width=1152&quality=70'; // Optimizer parameters

// Initialize Algod and Indexer Clients
// algosdk.Indexer uses axios internally, so it's still a dependency of algosdk
const indexerClient = new algosdk.Indexer({}, indexerBaseUrl, '');

// --- Decoding Function ---
async function decodeARC19Url(assetId) {
  try {
    // 1. Fetch Asset Information from Indexer
    console.log(`1. Fetching asset information for asset ID: ${assetId}`);
    const assetInfo = await indexerClient.lookupAssetByID(assetId).do();
    const assetParams = assetInfo.asset.params;
    console.log("    - Asset information found.");

    // 2. Extract Relevant Information
    console.log(`2. Extracting relevant information from asset parameters...`);
    const encodedUrl = assetParams.url;
    const reserveAddress = assetParams.reserve;
    console.log(`    - Encoded URL: ${encodedUrl}`);
    console.log(`    - Reserve Address: ${reserveAddress}`);

    // 3. Validate ARC19 URL
    console.log(`3. Validating ARC19 URL format...`);
    const templateRegex = /template-ipfs:\/\/{ipfscid:(\d):([a-z0-9-]+):reserve:([a-z0-9-]+)}/;
    const match = encodedUrl.match(templateRegex);

    if (!match) {
      throw new Error("Invalid ARC19 URL format.");
    }

    const version = parseInt(match[1]);
    const codecName = match[2];
    const hashTypeName = match[3];
    console.log(`    - Version: ${version}`);
    console.log(`    - Codec Name: ${codecName}`);
    console.log(`    - Hash Type Name: ${hashTypeName}`);

    // 4. Decode Reserve Address
    console.log(`4. Decoding reserve address...`);
    const reserveBytes = algosdk.decodeAddress(reserveAddress).publicKey;
    console.log(`    - Reserve Address (bytes):`, reserveBytes);

    // 5. Determine Multihash Type
    console.log(`5. Determining multihash type code from hash type name...`);
    const multihashTypeCode = multihash.names[hashTypeName];
    if (multihashTypeCode === undefined) {
      throw new Error(`Unsupported hash type: ${hashTypeName}`);
    }
    console.log(`    - Multihash Type Code: ${multihashTypeCode}`);

    // 6. Encode to Multihash
    console.log(`6. Encoding reserve bytes to multihash...`);
    const encodedMultihash = multihash.encode(reserveBytes, multihashTypeCode);
    console.log(`    - Encoded Multihash:`, encodedMultihash);

    // 7. Construct CID
    console.log(`7. Constructing CID...`);
    let cidInstance;
    if (version === 0) {
      if (codecName !== 'dag-pb') {
        throw new Error(`Invalid codec for CID v0: ${codecName}. Expected: dag-pb`);
      }
      if (hashTypeName !== 'sha2-256') {
        throw new Error(`Invalid hash type for CID v0: ${hashTypeName}. Expected: sha2-256`);
      }
      cidInstance = new cid(version, codecName, encodedMultihash);
    } else if (version === 1) {
      cidInstance = new cid(version, codecName, encodedMultihash);
    } else {
      throw new Error(`Unsupported CID version: ${version}`);
    }
    const cidStr = cidInstance.toString(); // Store CID string
    console.log(`    - CID String: ${cidStr}`);

    // 8. Build Full IPFS URL for metadata
    console.log(`8. Building full IPFS URL for metadata (with optimizer params)...`);
    console.log(`    - IPFS Gateway component: ${ipfsGateway}`);
    console.log(`    - CID component: ${cidStr}`);
    console.log(`    - Optimizer Params component: ${ipfsOptimizerParams}`);

    const metadataIpfsUrl = `${ipfsGateway}${cidStr}${ipfsOptimizerParams}`;
    console.log(`    - Final constructed Metadata IPFS URL: ${metadataIpfsUrl}`);

    // 9. Fetch and Display Metadata from IPFS using Fetch API
    console.log(`9. Fetching metadata from IPFS using Fetch API...`);
    let metadataJson; // To store the parsed JSON data
    try {
      // Explicitly check if optimizer params are in the URL string before the call
      if (!metadataIpfsUrl.includes("?optimizer=image")) {
        const errorMessage = "CRITICAL INTERNAL ERROR: Optimizer params are missing from metadataIpfsUrl string just before the fetch call!";
        console.error(errorMessage);
        console.error(`    - metadataIpfsUrl value: ${metadataIpfsUrl}`);
        throw new Error(errorMessage);
      }
      console.log(`    - Attempting to GET (Fetch API): ${metadataIpfsUrl}`);
      const response = await fetch(metadataIpfsUrl);

      console.log(`    - Fetch response status: ${response.status}`);
      if (!response.ok) {
        // Log response text if available for more details on the error
        const errorText = await response.text().catch(() => "Could not retrieve error text.");
        console.error(`    - Fetch error details: ${errorText}`);
        throw new Error(`Failed to fetch metadata from IPFS. Status: ${response.status}. URL: ${metadataIpfsUrl}`);
      }
      metadataJson = await response.json();
      console.log("    - Metadata fetched and parsed successfully (Fetch API).");
      // console.log("    - Metadata content:", metadataJson); // Uncomment for full metadata
    } catch (error) {
      console.error("    - Error fetching or parsing metadata from IPFS (Fetch API):", error.message);
      // Log the URL that was attempted if an error occurs
      console.error(`    - URL attempted during fetch error: ${metadataIpfsUrl}`);
      return null; // Return early on error
    }

    // 10. Extract and Display Image URL
    console.log(`10. Extracting image URL from metadata...`);
    if (!metadataJson || !metadataJson.image) {
        console.error("    - 'image' field not found in IPFS metadata.");
        // console.log("    - Full metadata received:", metadataJson);
        return {
            metadataIpfsUrl: metadataIpfsUrl,
            imageUrl: null
        };
    }
    const ipfsImageHash = metadataJson.image.replace("ipfs://", "");
    // Construct image URL, also with optimizer parameters
    const imageURL = `${ipfsGateway}${ipfsImageHash}${ipfsOptimizerParams}`;
    console.log(`    - Constructed Image URL: ${imageURL}`);

    return {
      metadataIpfsUrl: metadataIpfsUrl,
      imageUrl: imageURL
    };
  } catch (error) {
    console.error("Error decoding ARC19 URL:", error.message);
    // Removed axios specific error logging as we are not using it for this IPFS call
    return null;
  }
}

// --- Example Usage with Asset ID from Specification ---
async function main() {
  // Asset ID from ARC-0019 specification example
  const assetId = 812520710; // This asset is known to work

  console.log(`Attempting to decode ARC19 for asset ID: ${assetId}`);
  const decodedData = await decodeARC19Url(assetId);

  if (decodedData) {
    console.log("\nFinal Decoded IPFS Metadata URL:", decodedData.metadataIpfsUrl);
    if(decodedData.imageUrl) {
        console.log("Image URL:", decodedData.imageUrl);
    } else {
        console.log("Image URL could not be determined from metadata.");
    }
  } else {
    console.log("\nFailed to decode ARC19 URL for asset ID:", assetId);
  }
}

main();
