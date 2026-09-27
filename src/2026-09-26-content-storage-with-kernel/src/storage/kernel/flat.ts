import {ScalarKernel, StoreKernel, StoreRef} from "./types";

type FlatLocation = string & {readonly __flatLocationBrand: unique symbol}

export class FlatStoreKernel implements StoreKernel<FlatLocation, never> {
  readonly boolean = (() => {
    const map = new Map<FlatLocation, boolean>()
    return {
      initialize(_destination: never, value: boolean) {
        const location = `boolean:${value}:${Math.random()}` as StoreRef<boolean, FlatLocation>

        this.set(location, value)


        return location
      },
      get(location) {
        const value = map.get(location)
        if (value === undefined) throw new Error(`No value at location ${location}`)
        return value
      },
      set(location, value: boolean) {
        if (!map.has(location)) throw new Error(`No value at location ${location}`)
        map.set(location, value)
      },
    } as ScalarKernel<boolean, FlatLocation, never>
  })()
}

