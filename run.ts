import { ethers } from 'ethers'
import { Ticketing } from './src'
import * as dotenv from 'dotenv'
dotenv.config()

// Check if all env variables are in place before starting
const paramsToCheck = [
  'RECEIVER_DATABASE_USER',
  'RECEIVER_DATABASE_HOST',
  'RECEIVER_DATABASE_PASSWORD',
  'RECEIVER_DATABASE_NAME',
  'RECEIVER_DATABASE_PORT',
  'RECEIVER_DATABASE_PORT',
  'RECEIVER_DATABASE_MAX_CONNECTIONS',
  'TICKET_DATABASE_USER',
  'TICKET_DATABASE_HOST',
  'TICKET_DATABASE_PASSWORD',
  'TICKET_DATABASE_NAME',
  'TICKET_DATABASE_PORT',
  'TICKET_DATABASE_MAX_CONNECTIONS',
  'NETWORK_ID',
  'RUN_JOB_AFTER_MILLISECOND',
  'IF_FAILED_RETRY_AFTER',
  'SUBGRAPH_URL'
]
checkParams(paramsToCheck)

// Create signer and provider for interacting with blockchain
const provider = ethers.providers.getDefaultProvider(process.env.ARBITRUM_RPC_URL) // arbitrum-goerli
const privateKey = `${process.env.SIGNER_PRIVATE_KEY}`
const signer = new ethers.Wallet(privateKey, provider)

const config = {
  receiverConfig: {
    user: `${process.env.RECEIVER_DATABASE_USER}`,
    host: `${process.env.RECEIVER_DATABASE_HOST}`,
    password: `${process.env.RECEIVER_DATABASE_PASSWORD}`,
    database: `${process.env.RECEIVER_DATABASE_NAME}`,
    port: parseInt(`${process.env.RECEIVER_DATABASE_PORT}`),
    max: parseInt(`${process.env.RECEIVER_DATABASE_MAX_CONNECTIONS}`)
  },
  ticketConfig: {
    user: `${process.env.TICKET_DATABASE_USER}`,
    host: `${process.env.TICKET_DATABASE_HOST}`,
    password: `${process.env.TICKET_DATABASE_PASSWORD}`,
    database: `${process.env.TICKET_DATABASE_NAME}`,
    port: parseInt(`${process.env.TICKET_DATABASE_PORT}`),
    max: parseInt(`${process.env.TICKET_DATABASE_MAX_CONNECTIONS}`)
  },
  subgraphUrl: `${process.env.SUBGRAPH_URL}`
}

const ticketing = new Ticketing(config, signer)

ticketing
  .init()
  .then(
    async (a) => {
      a.telemetryJob(process.env.NETWORK_ID)
      a.dailyJob(
        `${process.env.NETWORK_ID}`,
        parseInt(`${process.env.RUN_JOB_AFTER_MILLISECOND}`),
        parseInt(`${process.env.IF_FAILED_RETRY_AFTER}`)
      )
    }
  )
  .catch(console.log)

function checkParams (params: string[]): void {
  for (let index = 0; index < params.length; index++) {
    const element = params[index]
    //   console.log(`${element}`);
    if (!(element in process.env)) {
      console.log(`${element} is not defined in env variables`)
      process.exit(1)
    }
  }
}
