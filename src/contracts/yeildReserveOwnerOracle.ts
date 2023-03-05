import { PCredential, PCurrencySymbol, POutputDatum, PScriptContext, PTxOutRef, asData, bool, bs, data, int, pBSToData, pBool, perror, pfn, pisEmpty, plam, plet, pmatch, pstruct, punBData, punConstrData, punsafeConvertType } from "@harmoniclabs/plu-ts";

const PYeildOwnerDatum = pstruct({
    PYeildOwnerDatum: {
        // likely a multi-sig at the beginning;
        // upgraded to community owned smart contract in the future
        owner: PCredential.type
    }
});

const PYeildOwnerRedeemer = pstruct({
    ChangeOwner: {
        newOwner: PCredential.type,
        ownInputIdx: int
    }
})

/**
 * since ownership is updated with current owner consent
 * we do not require additional restrictions ( such as identifying nfts here )
 * 
 * however these might be required and checked by other contracts
 */
const yeildReserveOwnerOracle = pfn([
    PYeildOwnerDatum.type,
    PYeildOwnerRedeemer.type,
    PScriptContext.type
],  bool)
(( datum, rdmr, _ctx ) => 

    _ctx.extract("txInfo","purpose").in(({ txInfo, purpose }) => {

    pmatch( rdmr )
    .onChangeOwner( _ => _.extract("newOwner","ownInputIdx").in( ({ newOwner, ownInputIdx }) =>
        txInfo.extract("signatories","outputs","inputs").in( tx =>
            
        plet(
            plam( PCredential.type, bs )
            ( creds => 
                punBData.$(
                    // both constructors have one field
                    // and in both that field is a byteString
                    // we don't care if it is PubKey or script
                    // so we just take the hash without all the matching
                    punConstrData.$( creds as any ).snd.head
                )
            )
        ).in( getHashFromCredentialsRegardles =>
        
        plet(
            getHashFromCredentialsRegardles.$(
                datum.extract("owner").in( ({ owner }) => owner )
            )
        ).in( ownerHash => 

        plet(
            getHashFromCredentialsRegardles.$( newOwner )
        ).in( newOwnerHash =>

            // require both old owner and new owner to sign
            tx.signatories.some( ownerHash.eqTerm )
            .and(
                tx.signatories.some( newOwnerHash.eqTerm )
            )
            // make sure info is updated
            .and(
                
                plet(
                    tx.inputs.at( ownInputIdx )
                ).in( _ownInput => _ownInput.extract("resolved","utxoRef").in( ownInput =>

                    ownInput.utxoRef.eq(
                        pmatch( purpose )
                        .onSpending( _ => _.extract("utxoRef").in( ({ utxoRef }) => utxoRef ))
                        ._( _ => perror( PTxOutRef.type ) )
                    )
                    .and(

                        ownInput.resolved.extract("address").in(({ address: ownAddr }) => 
    
                            tx.outputs.some( _out => _out.extract("address","datum").in( out =>
                        
                                out.datum.eq(
                                    POutputDatum.InlineDatum({
                                        datum: PYeildOwnerDatum.PYeildOwnerDatum({ owner: newOwner as any }) as any
                                    })
                                )
                                .and(
                                    out.address.eq( ownAddr )
                                )
        
                            ))

                        )
                        
                    )
                ))

            )

        )))
        )
    ))

    return pBool( false )
}))