import { PAddress, PCurrencySymbol, PScriptContext, bool, int, pBool, pand, pdelay, pfn, pif, plet, pmatch, pstruct, punConstrData, punIData } from "@harmoniclabs/plu-ts";

export const PLqStakingDatum = pstruct({
    PLqStakingDatum: {
        ownerAddr: PAddress.type,
        since: int,
    }
});

const PLqStakingRedeemer = pstruct({
    Harvest: {
        // MUST be first field
        reserveInputIdx: int,
        // 0 | 1
        // if less than 1 (0) rewards are sent to `ownerAddr` specified in the datumrewards are kept in the contract
        // else ( >=  1 ) rewards are kept in the contract and counted for next time
        autoAccum: int
    },
    Withdraw: {
        // MUST be first field
        reserveInputIdx: int
    }
});

const liquidityStakingContract = pfn([
    PCurrencySymbol.type,
    PLqStakingDatum.type,
    PLqStakingRedeemer.type,
    PScriptContext.type
], bool)
(( reserveProofCurrSym, datum, rdmr, ctx ) => {

    ctx.extract("txInfo").in( ({ txInfo }) =>
    txInfo.extract("inputs","outputs").in( tx =>

        plet(
            punConstrData.$( rdmr as any )
        ).in( deconstrRdmr => 
            
        tx.inputs.at(
            punIData.$(
                deconstrRdmr.snd.head
            )
        ).extract("resolved").in( ({ resolved: reserveInput }) =>
        reserveInput.extract("value","datum").in( ({ value: reserveInputVal }) =>
             
            pand.$(
                    reserveInputVal.some( entry => entry.fst.eq( reserveProofCurrSym ) )
                )
            )
            .$(pdelay(
                
                pif( bool )
                .$( deconstrRdmr.fst.eq(0) )
                .then( // onHarvest
    
                    pif( bool )
                    .$(
                        punIData.$(
                            deconstrRdmr.snd.tail.head
                        ) // autoAccum
                        .lt( 1 )
                    )
                    .then( // withdraw rewards to user
    
                    )
                    .else( // auto re stake rewards
    
                    )
    
                )
                .else( // onWithdraw
    
                )

            )))

        ))
        
    ))

    return pBool( false )
})