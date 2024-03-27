const { network, getNamedAccounts, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit tests", async () => {
          let deployer, raffle, raffleEntranceFee

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              const myContract = await deployments.get("Raffle")
              raffle = await ethers.getContractAt(myContract.abi, myContract.address)
              raffleEntranceFee = await raffle.getEntranceFee()
          })

          describe("fulfillRandomWords", async () => {
              it("works with live Chainklink Keepers and Chainlink VRF, we get a random winner", async () => {
                  // enter the raffle
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()

                  // setup listener before we enter the raffle
                  // Just in case the blockchain moves really fast

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Winner Picked event fired")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerStartingBalance = await ethers.provider.getBalance(
                                  accounts[0]
                              )
                              const winnerEndingBalance = await ethers.provider.getBalance(
                                  accounts[0]
                              )
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              await expect(raffle.getPlayer(0)).to.be.reverted
                              assert(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState.toString(), "0")
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (winnerStartingBalance + raffleEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error)
                          }
                      })
                      // Entering the raffle
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
                      // const winnerStartingBalance = await ethers.provider.getBalance(accounts[0])
                      // this won't finish until our listener has finished listening!

                      await tx.wait(1)
                      console.log("Time to wait...")
                      console.log("Listening to new promise...")
                  })
              })
          })
      })
