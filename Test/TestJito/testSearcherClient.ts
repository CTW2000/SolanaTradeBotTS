import { searcherClient } from '../../function/jitoBundle/clients';


//cd /root/ListenInRust/SolanaTradeBotTS && npx ts-node Test/TestJito/testSearcherClient.ts
async function main(): Promise<void> {
  try {
    console.log('Testing Jito SearcherClient connectivity...');

    const tipAccounts = await searcherClient.getTipAccounts();
    console.log('getTipAccounts() OK:', Array.isArray(tipAccounts) ? tipAccounts.length : tipAccounts);

    const nextLeader = await searcherClient.getNextScheduledLeader();
    console.log('getNextScheduledLeader() OK:', nextLeader);

    const connectedLeaders = await searcherClient.getConnectedLeaders();
    const numLeaders = connectedLeaders ? Object.keys(connectedLeaders).length : 0;
    console.log('getConnectedLeaders() OK:', numLeaders);

    console.log('SearcherClient basic checks passed.');
  } catch (err) {
    console.error('SearcherClient test failed:', err);
    process.exitCode = 1;
  }
}

void main();


