export class ShortLive {
    private _cacheList: Map<number, any> = new Map();
    private _id = 0;

    constructor(public deepEqual: Function, public timeout: number = 1000) {
    }

    public add(item: any) {
        let id = this._id;
        this._id = id + 1;
        this._cacheList.set(id, item);
        setTimeout(() => {
            this._cacheList.delete(id);
        }, this.timeout);
    }

    public isLive(data: any): boolean {
        for (let item of this._cacheList.values()) {
            if (this.deepEqual(item, data)) {
                return true;
            }
        }
        return false;
    }
}