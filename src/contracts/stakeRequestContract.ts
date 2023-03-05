import { PAddress, POutputDatum, PScriptContext, PValidatorHash, bool, int, pBool, pDataI, perror, pfn, plet, pmatch, pstruct, punBData, punConstrData } from "@harmoniclabs/plu-ts";
import { PLqStakingDatum } from "./liquidityStakingContract";

const PStakeRequestRedeemer = pstruct({
    Approve: {
        outToStakeContractIdx: int
    },
    Cancel: {} 
});

const stakeRequestContract = pfn([
    PValidatorHash.type,
    PAddress.type,
    PStakeRequestRedeemer.type,
    PScriptContext.type
],  bool)
(( 
    stakeContractValHash, 
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
            txInfo.extract("outputs","interval").in( tx =>

                tx.outputs.at( outToStakeContractIdx )
                .extract("address","datum").in( outGoingToStake => 

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
                )

            ))
        )
    
    )

    return pBool( false )
});