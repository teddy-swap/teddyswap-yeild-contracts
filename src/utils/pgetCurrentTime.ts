import { PExtended, PLowerBound, PPOSIXTimeRange, int, pInt, perror, phoist, plam, pmatch } from "@harmoniclabs/plu-ts";

/** **INLINED** */
const psecondsInDay = pInt( 86400 );

const pgetTimeFromBound = phoist(
    plam( PExtended.type, int )
    ( bound => 
        pmatch( bound )
        .onPFinite( _ => _.extract("_0").in( ({ _0 }) => _0.div( psecondsInDay ) ))
        ._( _ => perror( int ) )
    )
)

export const pgetLowerCurrentTime = phoist(
    plam( PPOSIXTimeRange.type, int )
    ( range => range.extract("from").in( ({ from }) =>
        from.extract("bound").in( ({ bound }) => pgetTimeFromBound.$( bound ) ) 
    ))
)

export const pgetUpperCurrentTime = phoist(
    plam( PPOSIXTimeRange.type, int )
    ( range => range.extract("to").in( ({ to }) =>
        to.extract("bound").in( ({ bound }) => pgetTimeFromBound.$( bound ) ) 
    ))
)