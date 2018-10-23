export function patchAsarRequire(appRoot: String) {
    const path = require('path');
    const Module = require('module');
    const NODE_MODULES_PATH = path.join(`${appRoot}/node_modules`);
    const NODE_MODULES_ASAR_PATH = NODE_MODULES_PATH + '.asar';

    const originalResolveLookupPaths = Module._resolveLookupPaths;
    Module._resolveLookupPaths = function (request: any, parent: any, newReturn: any) {
        const result = originalResolveLookupPaths(request, parent, newReturn);

        const paths = newReturn ? result : result[1];
        for (let i = 0, len = paths.length; i < len; i++) {
            if (paths[i] === NODE_MODULES_PATH) {
                paths.splice(i, 0, NODE_MODULES_ASAR_PATH);
                break;
            }
        }

        return result;
    };
}


export function getNodeModule(appRoot: string, moduleName: string) {
    try {
        return require(`${appRoot}/node_modules.asar/${moduleName}`);
    } catch (err) { }
    try {
        return require(`${appRoot}/node_modules/${moduleName}`);
    } catch (err) { }
    throw new Error(`Can not find module: ${moduleName}`)
}
