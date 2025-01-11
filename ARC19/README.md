## ARC19 Decoder (arc19.js)

This tool allows you to decode ARC19 URLs embedded within Algorand ASAs. It retrieves the associated metadata, including the IPFS link to the asset's content and, if available, the ARC69 metadata.

### What is ARC19?

ARC19 is a standard for creating mutable NFTs (Non-Fungible Tokens) on Algorand. It achieves this by utilizing a special URL format within the ASA's metadata that points to mutable data stored on IPFS. The URL template allows clients to reconstruct a valid IPFS Content Identifier (CID) based on information stored in the ASA's reserve address.

### Prerequisites

  * **Node.js:** You need to have Node.js installed on your system. You can download it from [https://nodejs.org/](https://www.google.com/url?sa=E&source=gmail&q=https://nodejs.org/).
  * **npm:** npm (Node Package Manager) is usually installed with Node.js.
  * **Git:** You'll need Git to clone this repository. You can download it from [https://git-scm.com/](https://www.google.com/url?sa=E&source=gmail&q=https://git-scm.com/).

### Setup

1.  **Clone the Repository:**

    ```bash
    git clone git@github.com:Wild-er/AVM-Tools.git  # Or use HTTPS: [https://github.com/Wild-er/AVM-Tools.git](https://github.com/Wild-er/AVM-Tools.git)
    cd AVM-Tools/ARCPAY/ARC19
    ```

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

    This command will install the necessary packages: `algosdk`, `multihashes`, `cids`, and `axios`.

### Usage

The main script is `arc19.js`. It takes an Algorand Asset ID as input and performs the following actions:

1.  **Fetches Asset Information:** Retrieves the asset's parameters from an Algorand Indexer node (currently configured for TestNet using Nodely endpoints).
2.  **Extracts ARC19 URL and Reserve Address:** Extracts the encoded ARC19 URL and the reserve address from the asset's parameters.
3.  **Decodes the ARC19 URL:**
      * Validates the URL format.
      * Decodes the reserve address into its byte representation.
      * Determines the multihash type code.
      * Encodes the reserve address bytes into a multihash.
      * Constructs the CID (Content Identifier).
      * Builds the full IPFS URL using the `ipfs.algonode.dev` gateway.
4.  **Fetches Metadata from IPFS (Optional):**
      * Attempts to retrieve and display the JSON metadata from the resolved IPFS URL.
5.  **Extracts Image URL (Optional):**
      * If the metadata contains an `image` property (in the format `ipfs://<CID>`), it constructs and displays the full image URL.
6.  **Extracts ARC69 Metadata (Optional):**
      * Attempts to retrieve and display ARC69 metadata from the reserve address's account information.

**To run the script:**

```bash
node arc19.js
```

**Example:**

By default, the script decodes a test asset (ID: `66753108` on TestNet) from the ARC19 specification example:

```bash
node arc19.js
```

**Output:**

```
1. Fetching asset information for asset ID: 66753108
   - Asset information found.
2. Extracting relevant information from asset parameters...
   - Encoded URL: template-ipfs://{ipfscid:0:dag-pb:reserve:sha2-256}
   - Reserve Address: EEQYWGGBHRDAMTEVDPVOSDVX3HJQIG6K6IVNR3RXHYOHV64ZWAEISS4CTI
3. Validating ARC19 URL format...
   - Version: 0
   - Codec Name: dag-pb
   - Hash Type Name: sha2-256
4. Decoding reserve address...
   - Reserve Address (bytes): Uint8Array(32) [ ... ]
5. Determining multihash type code from hash type name...
   - Multihash Type Code: 18
6. Encoding reserve bytes to multihash...
   - Encoded Multihash: Uint8Array(34) [ ... ]
7. Constructing CID...
   - CID: QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK
8. Building full IPFS URL...
   - IPFS URL: [https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK](https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK)
9. Attempting to extract ARC69 metadata (optional)...
   - Could not find asset info Network request error. Received status 404 (Not Found): no accounts found for address: EEQYWGGBHRDAMTEVDPVOSDVX3HJQIG6K6IVNR3RXHYOHV64ZWAEISS4CTI
10. Fetching and displaying metadata from IPFS...
   - Metadata fetched successfully: { ... }
11. Extracting and displaying image URL from metadata...
   - Image URL: [https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK](https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK)

Final Decoded IPFS URL: [https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK](https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK)
Image URL: [https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK](https://ipfs.algonode.dev/ipfs/QmQZyq4b89RfaUw8GESPd2re4hJqB8bnm4kVHNtyQrHnnK)
```

**Customization:**

  * **Asset ID:** To decode a different asset, change the `assetId` variable in the `main()` function of `arc19.js`.
  * **Network:** To switch between TestNet and MainNet, modify the `network` variable at the beginning of `arc19.js`.

**Network Configuration:**

The script currently uses the following endpoints:

  * **TestNet Indexer:** `https://testnet-idx.4160.nodely.dev`
  * **TestNet Algod:** `https://testnet-api.4160.nodely.dev`
  * **MainNet Indexer:** `https://mainnet-idx.4160.nodely.dev`
  * **MainNet Algod:** `https://mainnet-api.4160.nodely.dev`
  * **IPFS Gateway:** `https://ipfs.algonode.dev/ipfs/`

You can modify these URLs in the `arc19.js` file if you need to use different endpoints.

### Contributing

Contributions are welcome\! Please feel free to submit issues or pull requests.

### License

This project is licensed under the MIT License - see the LICENSE file for details.

### Spec
https://github.com/algorandfoundation/ARCs/blob/main/ARCs/arc-0019.md