export class ShortLive<T> {
    private _cacheList: Map<number, T> = new Map();
    private _id = 0;

    constructor(private _deepEqual: (item:T,data:T) => boolean, private _timeout: number = 1000) {
    }

    public add(item: T) {
        const id = this._id;
        this._id = id + 1;
        this._cacheList.set(id, item);
        setTimeout(() => {
            this._cacheList.delete(id);
        }, this._timeout);
    }

    public isLive(curr: T): boolean {
        for (let prev of this._cacheList.values()) {
            if (this._deepEqual(prev, curr)) {
                return true;
            }
        }
        return false;
    }
}


export function debounce(func: (...args: any[]) => void, delay: number=100) {
    let timeoutId: NodeJS.Timeout | null = null;
    return function (...args: any[]) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  }