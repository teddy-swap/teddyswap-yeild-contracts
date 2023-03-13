import { PAddress, PCurrencySymbol, POutputDatum, PScriptContext, PValidatorHash, bool, int, pBool, pDataI, pIntToData, perror, pfn, pisEmpty, plet, pmatch, pserialiseData, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";
import { PLqStakingDatum } from "./liquidityStakingContract";
import { pgetUpperCurrentTime } from "../utils/pgetCurrentTime";

const PStakeRequestRedeemer = pstruct({
    Approve: {
        outToStakeContractIdx: int
    },
    Cancel: {} 
});

const stakeRequestContract = pfn([
    PValidatorHash.type,
    PCurrencySymbol.type,
    PAddress.type,
    PStakeRequestRedeemer.type,
    PScriptContext.type
],  bool)
(( 
    stakeContractValHash,
    validStakeNFTProofPolicy,
    ownerAddress, rdmr, ctx
) => {

    ctx.extract("txInfo").in( ({ txInfo }) =>
    
        pmatch( rdmr )
        .onCancel( _ => // tx signed by who created the stake request
            txInfo.extract("signatories").in( ({ signatories }) =>
            ownerAddress.extract("credential").in( ({ credential }) => 
                plet(
                    // extract signer withut matching constructor
                    // if it is a validator hash will fail anyway
                    // since validator hashes are not included in the `signatories` field
                    punBData.$(
                        punConstrData.$(
                            credential as any
                        ).snd.head
                    )
                ).in( ownerHash => 
                    signatories.some( ownerHash.eqTerm )
                )
            )
        ))
        .onApprove( _ =>
            _.extract("outToStakeContractIdx").in( ({ outToStakeContractIdx }) => 
            txInfo.extract("inputs","outputs","interval","mint").in( tx =>

            tx.outputs.at( outToStakeContractIdx )
            .extract("address","datum","value").in( outGoingToStake => {

                const correctOutDatum = outGoingToStake.datum.eq(
                    POutputDatum.InlineDatum({
                        datum: PLqStakingDatum.PLqStakingDatum({
                            ownerAddr: ownerAddress as any,
                            since: pIntToData.$( pgetUpperCurrentTime.$( tx.interval ) )
                        }) as any
                    })
                ) 

                const outGoingToStakeValidator = outGoingToStake.address
                .extract("credential").in( ({ credential: outPaymentCreds }) =>
                
                    pmatch( outPaymentCreds )
                    .onPScriptCredential( _ => _.extract("valHash").in(({ valHash: outValHash }) => 
                        outValHash.eq( stakeContractValHash )
                    ))
                    ._( _ => perror( bool ) )

                )

                // output going to stake contract is marked with NFT
                const outContainsMintedNFT = plet( tx.mint.tail ).in( noADAValue =>

                    // the minted value (ADA excluded) only contains 1 policy
                    pisEmpty.$( noADAValue.tail )
                    .and(
                        // first policy is ADA
                        // (every on-chain value has ADA)
                        tx.mint.head.fst.eq("")
                    )
                    .and(

                        plet(
                            noADAValue.head
                        ).in( validStakeNFTProofEntry => 
                            // the minted assets are from a known policy
                            validStakeNFTProofEntry.fst.eq( validStakeNFTProofPolicy )
                            .and(

                                // we perform here the minting validation
                                // because we want to be 100% sure that the minted token is unique
                                plet(
                                    validStakeNFTProofEntry.snd
                                ).in( validStakeNFTProofAssets =>

                                    // single asset minted
                                    pisEmpty.$( validStakeNFTProofAssets.tail ) 
                                    .and(
                                        plet( validStakeNFTProofAssets.head )
                                        .in( validStakeNFTProofAsset =>

                                            validStakeNFTProofAsset.fst.eq(
                                                
                                                // asset name is the CBOR-serialized format
                                                // of the first input of this transaction.
                                                tx.inputs.at(0)
                                                .extract("utxoRef")
                                                .in( ({ utxoRef }) => 
                                                    pserialiseData.$( utxoRef as any )
                                                )

                                            )
                                            .and(
                                                // quantity is 1
                                                validStakeNFTProofAsset.snd.eq( 1 )
                                            )
                                        )
                                    )

                                )
                            )
                        )

                    )
                    .and(
                        outGoingToStake.value.some( entry => entry.fst.eq( validStakeNFTProofPolicy ) )
                    )

                );

                return correctOutDatum
                .and(  outGoingToStakeValidator )
                .and(  outContainsMintedNFT     );

            })))
        )
    
    )

    return pBool( false )
});