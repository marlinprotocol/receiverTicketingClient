import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { ethers } from 'ethers'
import { DB } from '../src/db';
import { Subgraph } from '../src/subgraph'
import { IClusterSelector__factory } from '../src/generated/factory/IClusterSelector__factory'
import { type IClusterSelector } from '../src/generated/IClusterSelector'
const dataConfig = require('./config.json');

let ticketClient: PoolClient;
let receiverClient: PoolClient;
let epochLength: number;
let startTime: number;
let subgraph: Subgraph;
let clusterSelector: IClusterSelector;

const init = async (networkId) => {
    subgraph = new Subgraph(dataConfig.subgraphUrl)
    const ticketConfig = dataConfig.ticketConfig
    const receiverConfig = dataConfig.receiverConfig
    const configData = await subgraph.getConfigData()
    epochLength = configData.params
      .filter((a) => a.id === 'EPOCH_LENGTH')
      .map((a) => parseInt(a.value))[0]
    startTime = configData.params
      .filter((a) => a.id === 'START_TIME')
      .map((a) => parseInt(a.value))[0]
    const clusterSelectorAddress = configData.selectors.filter((a) => a.networkId == networkId)[0].id;
    ticketClient = await new Pool(ticketConfig).connect();
    receiverClient = await new Pool(receiverConfig).connect();
    const provider = new ethers.providers.JsonRpcProvider(dataConfig.rpc_url)
    const privateKey = dataConfig.signer_key
    const signer = new ethers.Wallet(privateKey, provider)
    clusterSelector = IClusterSelector__factory.connect(clusterSelectorAddress, signer)

    await ticketClient.query(`
    CREATE TABLE IF NOT EXISTS msg_recvs
  (
      host character varying NOT NULL,
      message_id character varying NOT NULL,
      cluster character varying NOT NULL,
      ts timestamp NOT NULL,
      "offset" character varying NOT NULL
  );
  
  ALTER TABLE IF EXISTS msg_recvs
      OWNER to postgres;
      `);
}

const injectTicketsForEpoch = async (epochs: number[], clusters: string[][]) => {
  console.log("injecting tickets");
  const promises: Promise<any>[] = [];
  console.log(startTime, epochLength, startTime + (epochs[0] - 1)*epochLength);
  console.log(clusters[0]);
  console.log(clusters[epochs.length-1]);
  for(let i=0; i < epochs.length; i++) {
    const epochStart = startTime + (epochs[i] - 1)*epochLength
    for(let k=0; k < epochLength; k+=12) {
      for(let j=0; j < clusters[i].length; j++) {
        const randomTs = Math.floor(Math.random()*12)+k*12+epochStart;
        let insertPromise = ticketClient.query(`
          INSERT INTO msg_recvs (host, message_id, cluster, ts, "offset")
          VALUES('1.2.3.4', '${Math.random()*Number.MAX_SAFE_INTEGER}', '${clusters[i][j].toLowerCase()}', $1, '0')
        `, [new Date(randomTs*1000).toUTCString()]);
  
        promises.push(insertPromise);
      }
    }
  }
  await Promise.all(promises);
  console.log('Tickets injected');
}

const generateTicketsForEpoch = async (networkId, startEpoch, noOfEpochs) => {
  await init(networkId);
  const epochs: number[] = Array.from({length: noOfEpochs}, (_, i) => startEpoch + i);
  const clusters: string[][] = [];
  console.log(`generating tickets for epochs from ${startEpoch} to ${startEpoch + noOfEpochs - 1}`);
  for(let i=0; i < epochs.length; i++) {
    const selectedNodes = await clusterSelector.callStatic.getClusters(epochs[i]);
    clusters.push(selectedNodes);
  }
  await injectTicketsForEpoch(epochs, clusters);
}

generateTicketsForEpoch(ethers.utils.id("ETH"), 2996, 96);