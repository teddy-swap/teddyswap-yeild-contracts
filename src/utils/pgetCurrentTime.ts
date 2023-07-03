import { PExtended, PPOSIXTimeRange, int, pInt, perror, phoist, plam, pmatch } from "@harmoniclabs/plu-ts";

/** **INLINED** */
const pmillisecondsInDay = pInt( 86_400_000 );

const pgetTimeFromBound = phoist(
    plam( PExtended.type, int )
    ( bound => 
        pmatch( bound )
        .onPFinite( ({ _0 }) => _0.div( pmillisecondsInDay ) )
        ._( _ => perror( int ) )
    )
)

export const pgetLowerCurrentTime = phoist(
    plam( PPOSIXTimeRange.type, int )
    ( ({ from }) => pgetTimeFromBound.$( from.bound ) )
)

export const pgetUpperCurrentTime = phoist(
    plam( PPOSIXTimeRange.type, int )
    ( ({ to }) => pgetTimeFromBound.$( to.bound ) ) 
)