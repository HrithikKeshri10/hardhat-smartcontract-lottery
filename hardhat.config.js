require("hardhat-deploy")
require("solidity-coverage")
require("dotenv").config()
require("hardhat-contract-sizer")
require("hardhat-gas-reporter")
require("@nomiclabs/hardhat-ethers")
require("@nomicfoundation/hardhat-verify")
require("@nomicfoundation/hardhat-ethers")
require("@nomiclabs/hardhat-ethers")
require("@nomicfoundation/hardhat-chai-matchers")

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
const PRIVATE_KEY = process.env.PRIVATE_KEY
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    defaultNetwork: "hardhat",

    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [PRIVATE_KEY],
            chainId: 11155111,
            blockConfirmations: 6,
        },
    },

    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },

    solidity: {
        compilers: [{ version: "0.8.7" }, { version: "0.8.24" }],
    },

    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },

    gasReporter: {
        enabled: false,
        outputFile: "gas-report.txt",
        noColors: true,
        currency: "USD",
        coinmarketcap: COINMARKETCAP_API_KEY,
        //token: "MATIC",
    },
}
