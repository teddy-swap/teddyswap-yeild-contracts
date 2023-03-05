import { PCurrencySymbol, PTokenName, pair, palias } from "@harmoniclabs/plu-ts";

const PAssetClass = palias(
    pair(
        PCurrencySymbol.type,
        PTokenName.type
    )
);

export default PAssetClass;