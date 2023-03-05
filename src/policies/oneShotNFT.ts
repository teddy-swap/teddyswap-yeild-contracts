import { PList, PScriptContext, V2, bool, bs, data, fromData, perror, pfn, pfromData, pisEmpty, plet, pmatch, pserialiseData, pstruct, ptrace, punsafeConvertType, termTypeToString } from "@harmoniclabs/plu-ts";

export const MintRdmr = pstruct({
    Mint: {},
    Burn: {}
});

export const oneShotNFT = pfn([
    V2.PTxOutRef.type,

    MintRdmr.type,
    V2.PScriptContext.type

],  bool)
(( utxo, rdmr, ctx ) =>
    
    ctx.extract("txInfo","purpose").in( ({ txInfo, purpose }) =>
    txInfo.extract("inputs","mint").in( tx =>

        plet(
            pmatch( purpose )
            .onMinting( _ => _.extract("currencySym").in( ({ currencySym }) => currencySym ))
            ._( _ => perror( V2.PCurrencySymbol.type ) as any )
        ).in( ownCurrSym => 

        pmatch( rdmr )
        .onMint( _ =>

            tx.inputs.some( input =>
                input.extract("utxoRef").in( ({ utxoRef }) => utxoRef.eq( utxo ) )
            )
            .and(
    
                tx.mint.some( entry => {

                    return entry.fst.eq( ownCurrSym )
                    .and(
                        plet( entry.snd ).in( assets =>

                            pisEmpty.$( assets.tail )
                            .and(
                                assets.head.snd.eq( 1 )
                            )

                        )
                    )

                })

            )

        )
        .onBurn( _ =>
            tx.mint.some( entry =>

                entry.fst.eq( ownCurrSym )

                .and(
                    plet( entry.snd ).in( assets =>

                        pisEmpty.$( assets.tail )
                        .and(
                            assets.head.snd.lt( 0 )
                        )

                    )
                )

            ) 
        )
    
    )))
)