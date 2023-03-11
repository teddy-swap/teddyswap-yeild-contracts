import { PAddress, PCurrencySymbol, POutputDatum, PScriptContext, PValidatorHash, bool, int, pBool, pDataI, perror, pfn, pisEmpty, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";
import { PLqStakingDatum } from "./liquidityStakingContract";

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
    markerNFTPolicy,
    ownerAddress, rdmr, ctx
) => {

    ctx.extract("txInfo").in( ({ txInfo }) =>
    
        pmatch( rdmr )
        .onCancel( _ => 
            txInfo.extract("signatories").in( ({ signatories }) =>
            ownerAddress.extract("credential").in( ({ credential }) => 
                plet(
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
            txInfo.extract("outputs","interval","mint").in( tx =>

                tx.outputs.at( outToStakeContractIdx )
                .extract("address","datum","value").in( outGoingToStake => 

                    outGoingToStake.datum.eq(
                        POutputDatum.InlineDatum({
                            datum: PLqStakingDatum.PLqStakingDatum({
                                ownerAddr: ownerAddress as any,
                                since: pDataI(0) // TODO epoch calculation
                            }) as any
                        })
                    )
                    .and(
                        outGoingToStake.address
                        .extract("credential").in( ({ credential: outPaymentCreds }) =>
                        
                            pmatch( outPaymentCreds )
                            .onPScriptCredential( _ => _.extract("valHash").in(({ valHash: outValHash }) => 
                                outValHash.eq( stakeContractValHash )
                            ))
                            ._( _ => perror( bool ) )

                        )
                    )
                    // output going to stake contract is marked with NFT
                    .and(

                        plet(
                            tx.mint.tail
                        ).in( markerMintEntry =>

                            // minting contains only 2 policies
                            pisEmpty.$( markerMintEntry.tail )
                            .and(
                                // firs policy is ADA
                                // (every on chain value has ADA)
                                tx.mint.head.fst.eq("")
                            )
                            .and(
                                // the minted assets are from a known policy
                                // (minting validation forwarded to policy)
                                markerMintEntry.head.fst.eq( markerNFTPolicy )
                            )
                            .and(
                                // the minted token (assumed to be 1) goes to the stake contract utxo
                                outGoingToStake.value.some( entry => entry.fst.eq( markerNFTPolicy ) )
                            )

                        )


                    )

                )

            ))
        )
    
    )

    return pBool( false )
});