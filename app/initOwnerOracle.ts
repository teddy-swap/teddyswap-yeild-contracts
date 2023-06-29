import { Address, PCredential, PaymentCredentials, TxOutRef, Value, pData } from "@harmoniclabs/plu-ts";
import { cli } from "./utils/cli";
import { readFile } from "fs/promises";
import { MintRdmr } from "../src/policies/oneShotNFT";


async function setup()
{
    const address = cli.utils.readAddress("./testnet/address1.addr");
    const privateKey = cli.utils.readPrivateKey("./testnet/payment1.skey");

    const utxos = await cli.query.utxo({ address });

    // mustSpendUtxo.txt created calling compile
    const [ txId, idx ] = (await readFile("./testnet/mustSpendUtxo.txt", { encoding: "utf-8" })).split("#");

    const mustSpend = new TxOutRef({
        id: txId,
        index: parseInt( idx )
    });

    const utxo = utxos.find( u => u.utxoRef.id.toString() === mustSpend.id.toString() && u.utxoRef.index === mustSpend.index );

    if( utxo === undefined )
    {
        throw "can't find " + mustSpend.toString();
    }

    const oneShotNFT = cli.utils.readScript("./testnet/oneShotNFT.plutus.json");

    const yeildReserveOwnerOracle = cli.utils.readScript("./testnet/yeildReserveOwnerOracle.plutus.json");

    const yeildReserveOwnerOracleAddr = new Address(
        "testnet",
        PaymentCredentials.script( yeildReserveOwnerOracle.hash )
    );

    // promise
    cli.utils.writeAddress( yeildReserveOwnerOracleAddr, "./testnet/yeildReserveOwnerOracle.addr" );

    let tx = await cli.transaction.build({
        inputs: [{ utxo }],
        collaterals: [ utxo ],
        collateralReturn: {
            address: address,
            value: Value.sub(
                utxo.resolved.value,
                Value.lovelaces( 5_000_000 )
            )
        },
        mints: [
            {
                value: new Value([
                    {
                        policy: oneShotNFT.hash,
                        assets: [{ name: new Uint8Array([]), quantity: 1 }]
                    }
                ]),
                script: {
                    inline: oneShotNFT,
                    redeemer: MintRdmr.Mint({}),
                    policyId: oneShotNFT.hash
                }
            }
        ],
        outputs: [
            {
                address: yeildReserveOwnerOracleAddr,
                value: new Value([
                    Value.lovelaceEntry( 2_000_000 ),
                    Value.singleAssetEntry(
                        oneShotNFT.hash,
                        new Uint8Array([]),
                        1
                    )
                ]),
                datum: PCredential.PPubKeyCredential({
                    pkh: pData( address.paymentCreds.hash.toData() )
                })
            }
        ],
        changeAddress: address
    });

    tx = await cli.transaction.sign({ tx, privateKey });

    await cli.transaction.submit({ tx });
}
setup();