const fs = require('fs');
const path = require('path');
const BlockDesk = artifacts.require("BlockDesk");

module.exports = async function (deployer, network, accounts) {
  // 1. Deploy the Contract
  await deployer.deploy(BlockDesk);
  const blockDesk = await BlockDesk.deployed();
  console.log("BlockDesk deployed to:", blockDesk.address);

  // 2. Read 'manager.txt'
  const addressPath = path.join(__dirname, '..', 'manager.txt');
  
  if (fs.existsSync(addressPath)) {
    console.log("\nReading managers from file...");
    
    // Read file and split by new lines
    const fileContent = fs.readFileSync(addressPath, 'utf8');
    const addresses = fileContent
      .split(/\r?\n/)          // Split by new line (handles Windows & Mac)
      .map(line => line.trim()) // Remove whitespace
      .filter(line => line.startsWith("0x")); // Only keep lines starting with '0x'

    if (addresses.length > 0) {
      console.log(`Found ${addresses.length} address(es) to promote.`);

      // 3. Loop through every address found
      for (const address of addresses) {
        if (address.length === 42) { // Basic check for valid Ethereum address length
          try {
            console.log(`Promoting ${address}...`);
            await blockDesk.setUserRole(address, 1);
            console.log(`✅ Success`);
          } catch (error) {
            console.error(`❌ Failed: ${error.message}`);
          }
        } else {
          console.log(`⚠️ Skipping invalid address: ${address}`);
        }
      }
    } else {
      console.log("⚠️ No valid addresses found in manager.txt");
    }
  } else {
    console.log("⚠️ manager.txt not found. Skipping role assignment.");
  }
};