import {
    int,
    pInt,
    pfn,
    phoist,
    bs,
    pmatch,
    PCurrencySymbol,
    PTokenName,
    PAssetsEntryT,
    PValue,
    PValueEntryT,
    fn,
    list,
    pdelay,
    pif,
    precursiveList
} from "@harmoniclabs/plu-ts";

/**
 * ### O(n + m)
 * where
 * - `n` is the number of policies and
 * - `m` is the number of the assets of the desired policy
 *
 * @returns the amount of the specified asset class if present;
 * @returns `0` if the asset class is missing
 *  
**/
export const _pvalueOf = phoist(
    pfn([
        PValue.type,
        bs,
        bs
    ],  int)
    (( value, currSym, tokenName ) =>
        pmatch(
            value.find( entry => 
                entry.fst.eq( currSym )
            )
        )
        .onJust( _ => _.extract("val").in( ({ val: policyEntry }) => {

            return pmatch(
                    policyEntry.snd.find( assetEntry => 
                        {
                            return assetEntry.fst.eq( tokenName )
                        }
                    )
                )
                .onJust( _ => _.extract("val").in(({ val: entry }) =>
                    entry.snd 
                ))
                .onNothing( _ => pInt( 0 ) );
        }))
        .onNothing( _ => pInt( 0 ) )
            
    )
);

export const pvalueOf = phoist(
    pfn([
        PValue.type,
        PCurrencySymbol.type,
        PTokenName.type
    ],  int)
    (( value, currSym, tokenName ) =>
        precursiveList( int, PValueEntryT )
        .$( _self => pdelay( pInt(0) ) )
        .$( 

            pfn([
                fn([ list(PValueEntryT) ], int ),
                PValueEntryT,
                list( PValueEntryT )
            ],  int)

            ((self, head, tail ) =>
                pif( int ).$( head.fst.eq( currSym ) )
                .then(

                    precursiveList( int, PAssetsEntryT )
                    .$( _self => pdelay( pInt(0) ) )
                    .$(

                        pfn([
                            fn([ list(PAssetsEntryT) ], int ),
                            PAssetsEntryT,
                            list( PAssetsEntryT )
                        ],  int)

                        ((self, head, tail) =>
                            pif( int ).$( head.fst.eq( tokenName ) )
                            .then( head.snd )
                            .else( self.$( tail ) as any )
                        )
                    )
                    .$( head.snd )
                )
                .else( self.$( tail ) as any )
            )
        )
        .$( value )
    )
);
