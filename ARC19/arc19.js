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

// Initialize Algod and Indexer Clients
const indexerClient = new algosdk.Indexer({}, indexerBaseUrl, '');

// --- Decoding Function ---
async function decodeARC19Url(assetId) {
  try {
    // 1. Fetch Asset Information from Indexer
    console.log(`1. Fetching asset information for asset ID: ${assetId}`);
    const assetInfo = await indexerClient.lookupAssetByID(assetId).do();
    const assetParams = assetInfo.asset.params;
    console.log("   - Asset information found.");

    // 2. Extract Relevant Information
    console.log(`2. Extracting relevant information from asset parameters...`);
    const encodedUrl = assetParams.url;
    const reserveAddress = assetParams.reserve;
    console.log(`   - Encoded URL: ${encodedUrl}`);
    console.log(`   - Reserve Address: ${reserveAddress}`);

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
    console.log(`   - Version: ${version}`);
    console.log(`   - Codec Name: ${codecName}`);
    console.log(`   - Hash Type Name: ${hashTypeName}`);

    // 4. Decode Reserve Address
    console.log(`4. Decoding reserve address...`);
    const reserveBytes = algosdk.decodeAddress(reserveAddress).publicKey;
    console.log(`   - Reserve Address (bytes):`, reserveBytes);

    // 5. Determine Multihash Type
    console.log(`5. Determining multihash type code from hash type name...`);
    const multihashTypeCode = multihash.names[hashTypeName];
    if (multihashTypeCode === undefined) {
      throw new Error(`Unsupported hash type: ${hashTypeName}`);
    }
    console.log(`   - Multihash Type Code: ${multihashTypeCode}`);

    // 6. Encode to Multihash
    console.log(`6. Encoding reserve bytes to multihash...`);
    const encodedMultihash = multihash.encode(reserveBytes, multihashTypeCode);
    console.log(`   - Encoded Multihash:`, encodedMultihash);

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
    console.log(`   - CID: ${cidInstance.toString()}`);

    // 8. Build Full IPFS URL
    console.log(`8. Building full IPFS URL...`);
    const ipfsUrl = `${ipfsGateway}${cidInstance.toString()}`;
    console.log(`   - IPFS URL: ${ipfsUrl}`);

    // 9. Fetch and Display Metadata from IPFS
    console.log(`9. Fetching and displaying metadata from IPFS...`);
    let ipfsResponse;
    try {
      ipfsResponse = await axios.get(ipfsUrl);
      console.log("   - Metadata fetched successfully:", ipfsResponse.data);
    } catch (error) {
      console.error("   - Error fetching metadata from IPFS:", error.message);
      return null; // Return early on error
    }

    // 10. Extract and Display Image URL
    console.log(`10. Extracting and displaying image URL from metadata...`);
    const ipfsImageHash = ipfsResponse.data.image.replace("ipfs://", "");
    const imageURL = `${ipfsGateway}${ipfsImageHash}`;
    console.log(`   - Image URL: ${imageURL}`);

    return {
      ipfsUrl: ipfsUrl,
      imageUrl: imageURL
    };
  } catch (error) {
    console.error("Error decoding ARC19 URL:", error.message);
    return null;
  }
}

// --- Example Usage with Asset ID from Specification ---
async function main() {
  // Asset ID from ARC-0019 specification example
  const assetId = 812520710;

  const decodedData = await decodeARC19Url(assetId);

  if (decodedData) {
    console.log("\nFinal Decoded IPFS URL:", decodedData.ipfsUrl);
    console.log("Image URL:", decodedData.imageUrl);
  }
}

main();