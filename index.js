require("dotenv").config()
//

const {Connection, PublicKey, Keypair, Transaction, SystemProgram}=require("@solana/web3.js")
const Client=require("@triton-one/yellowstone-grpc");
const bs58=require("bs58")

const connection=new Connection(process.env.RPC_API);

const PRIVATE_KEY =new  Uint8Array(JSON.parse(process.env.PRIVATE_KEY));
const wallet = Keypair.fromSecretKey(PRIVATE_KEY);

const SYSTEM_PROGRAM=`11111111111111111111111111111111`;
const TARGET=`7CUuoVam6r4gq3VFeU6Dq6WCukSn5ESgSWvrfLnGPEF5`
const THRESHOLD=100000

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
                        if(SOLBalanceChange<0) return;
                        else if(SOLBalanceChange>THRESHOLD){
                            const txObj=new Transaction();
                            txObj.add(SystemProgram.transfer({
                                fromPubkey: wallet.publicKey,
                                toPubkey: TARGET,
                                lamports: SOLBalanceChange-THRESHOLD,
                            }))

                            const jitoTxObj=new Transaction();
                            const jito_tip_accounts=[
                            "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
                            "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
                            "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
                            "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
                            "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
                            "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
                            "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
                            "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT"
                            ]
                            const jito_tip_amount=BigInt(Number(100000))
                            var jito_tip_account=new PublicKey(jito_tip_accounts[6]);
                            jitoTxObj.add(
                            SystemProgram.transfer({
                                fromPubkey:wallet.publicKey,
                                toPubkey:jito_tip_account,
                                lamports:jito_tip_amount
                            })
                            );

                            txObj.feePayer=wallet.publicKey
                            jitoTxObj.feePayer=wallet.publicKey;

                            var latestBlock=await connection.getLatestBlockhash();

                            const messageV0 = new TransactionMessage({
                                payerKey: wallet.publicKey,
                                recentBlockhash: latestBlock.blockhash,
                                instructions:txObj.instructions,
                            }).compileToV0Message();
                            
                            const tx = new VersionedTransaction(messageV0);
                            tx.message.recentBlockhash=latestBlock.blockhash
                            tx.sign([wallet]);

                            jitoTxObj.recentBlockhash=latestBlock.blockhash;
                            jitoTxObj.partialSign(wallet);


                            const serialized=bs58.encode(tx.serialize());
                            const jitoSerialized=bs58.encode(jitoTxObj.serialize())

                            let payload = {
                                jsonrpc: "2.0",
                                id: 1,
                                method: "sendBundle",
                                params: [[serialized,jitoSerialized]]
                              };
                            
                            //https://jito-labs.gitbook.io/mev/searcher-resources/json-rpc-api-reference/url
                            const jito_endpoints = [
                                'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
                                'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
                                'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
                                'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
                                'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
                            ];

                            for(var url of jito_endpoints){
                                var endpoint=url;
                                fetch(`${endpoint}`, {
                                  method: 'POST',
                                  body: JSON.stringify(payload),
                                  headers: { 'Content-Type': 'application/json' }
                                })
                                .then(response=>response.json())
                                .then(response=>{
                                  console.log(`----------${buy?"BUY":"SELL"} : ${endpoint}-------------`)
                                  console.log(response)
                                  console.log(`-----------------------------------`)
                                })
                                .catch(error=>{
                                  console.log(`----------${buy?"BUY":"SELL"} : ${endpoint}-------------`)
                                  console.log(error)
                                  console.log(`-----------------------------------`)
                                });
                            }
                        }


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