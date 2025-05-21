const algosdk = require('algosdk');
const multihash = require('multihashes');
const cid = require('cids');
const axios = require('axios'); // Add axios for HTTP requests

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
    console.log(`    - CID: ${cidInstance.toString()}`);

    // 8. Build Full IPFS URL for metadata
    console.log(`8. Building full IPFS URL for metadata (with optimizer params)...`);
    // This URL is for the metadata JSON file, now also including optimizer params as requested.
    const metadataIpfsUrl = `${ipfsGateway}${cidInstance.toString()}${ipfsOptimizerParams}`;
    console.log(`    - Metadata IPFS URL: ${metadataIpfsUrl}`);

    // 9. Fetch and Display Metadata from IPFS
    console.log(`9. Fetching metadata from IPFS (using URL with optimizer params)...`);
    let ipfsResponse;
    try {
      // Fetching metadata using the URL that includes optimizer parameters.
      ipfsResponse = await axios.get(metadataIpfsUrl);
      console.log("    - Metadata fetched successfully:", ipfsResponse.data);
    } catch (error) {
      console.error("    - Error fetching metadata from IPFS:", error.message);
      // The retry logic is implicitly handled if the first attempt fails and an error is thrown.
      // No need for a separate retry block if the primary fetch now uses the desired URL.
      // If the error is critical, it will be caught by the outer try-catch.
      if (error.response) {
        console.error("    - Axios error details (metadata fetch):", error.response.data, error.response.status, error.response.headers);
      }
      return null; // Return early on error
    }

    // 10. Extract and Display Image URL
    console.log(`10. Extracting and displaying image URL from metadata...`);
    if (!ipfsResponse.data || !ipfsResponse.data.image) {
        console.error("    - 'image' field not found in IPFS metadata.");
        return {
            metadataIpfsUrl: metadataIpfsUrl, // Still return the metadata URL
            imageUrl: null
        };
    }
    const ipfsImageHash = ipfsResponse.data.image.replace("ipfs://", "");
    // Construct image URL, also with optimizer parameters
    const imageURL = `${ipfsGateway}${ipfsImageHash}${ipfsOptimizerParams}`;
    console.log(`    - Image URL: ${imageURL}`);

    return {
      metadataIpfsUrl: metadataIpfsUrl, // Changed from ipfsUrl to metadataIpfsUrl for clarity
      imageUrl: imageURL
    };
  } catch (error) {
    console.error("Error decoding ARC19 URL:", error.message);
    if (error.response) {
        // Log more details if it's an axios error
        console.error("Axios error details (general):", error.response.data, error.response.status, error.response.headers);
    }
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
        console.log("Image URL could not be determined.");
    }
  } else {
    console.log("\nFailed to decode ARC19 URL.");
  }

  // Example with a different asset (ensure it's ARC19)
  // const anotherAssetId = 123456789; // Replace with another valid ARC19 asset ID
  // console.log(`\nAttempting to decode ARC19 for asset ID: ${anotherAssetId}`);
  // const decodedDataAnother = await decodeARC19Url(anotherAssetId);
  // if (decodedDataAnother) {
  //   console.log("\nFinal Decoded IPFS Metadata URL:", decodedDataAnother.metadataIpfsUrl);
  //   if(decodedDataAnother.imageUrl) {
  //       console.log("Image URL:", decodedDataAnother.imageUrl);
  //   } else {
  //       console.log("Image URL could not be determined.");
  //   }
  // } else {
  //   console.log("\nFailed to decode ARC19 URL for asset:", anotherAssetId);
  // }
}

main();
