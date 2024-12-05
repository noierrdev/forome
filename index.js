require("dotenv").config()
//7CUuoVam6r4gq3VFeU6Dq6WCukSn5ESgSWvrfLnGPEF5

const {Connection, PublicKey, Keypair}=require("@solana/web3.js")
const Client=require("@triton-one/yellowstone-grpc");
const bs58=require("bs58")

const connection=new Connection(process.env.RPC_API);

const PRIVATE_KEY =new  Uint8Array(JSON.parse(process.env.PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

const SYSTEM_PROGRAM=`11111111111111111111111111111111`;

function connectGeyser(){
    const client =new Client.default("http://127.0.0.1:10000/","xToken",undefined);
    client.getVersion()
    .then(async version=>{
        try {
            console.log(version)
            const request =Client.SubscribeRequest.fromJSON({
                accounts: {},
                slots: {},
                transactions: {
                    pumpfun: {
                        vote: false,
                        failed: false,
                        signature: undefined,
                        accountInclude: [wallet.publicKey.toBase58()],
                        accountExclude: [],
                        accountRequired: [],
                    },
                },
                transactionsStatus: {},
                entry: {},
                blocks: {},
                blocksMeta: {},
                accountsDataSlice: [],
                ping: undefined,
                commitment: Client.CommitmentLevel.PROCESSED
            })
        
            const stream =await client.subscribe();
            stream.on("data", async (data) => {
                if(data.transaction&&data.transaction.transaction&&data.transaction.transaction.signature) {
                        const transaction=data.transaction.transaction;
                        const sig=bs58.encode(data.transaction.transaction.signature)
                        const allAccounts=[];
                        var systemProgramIndex
                        transaction.transaction.message.accountKeys.map((account,index)=>{
                            if(!account) return;
                            const accountID=bs58.encode(account);
                            if(accountID==SYSTEM_PROGRAM) systemProgramIndex=index;
                            allAccounts.push(accountID);
                        })
                        console.log(`https://solscan.io/tx/${sig}`)
                        console.log(allAccounts)
                        const systemProgramInstruction=transaction.transaction.message.instructions.find(instruction=>instruction.programIdIndex==systemProgramIndex);
                        console.log(systemProgramInstruction)
                        const SOLBalanceChange=transaction.meta.postBalances[0]-transaction.meta.preBalances[0]
                        console.log(SOLBalanceChange)


                }
            });
            await new Promise((resolve, reject) => {
                stream.write(request, (err) => {
                    if (err === null || err === undefined) {
                    resolve();
                    } else {
                    reject(err);
                    }
                });
            }).catch((reason) => {
                console.error(reason);
                throw reason;
            });
        } catch (error) {
            console.log(error)
            console.log("RECONNECTING!!!")
            setTimeout(() => {
                connectGeyser()
            }, 2000);
            
        }

    });
}
connectGeyser()