module.exports = function assignAsyncAspect(obj, regexp, preFn, postFn) {
    const re = new RegExp(regexp);
    for (let fname in obj) {
        if (fname.match(re)) {
            let originalFn = obj[fname];
            obj[fname] = async function () {
                preFn && await preFn.apply(this, arguments);
                let result = await originalFn.apply(this, arguments);
                postFn && await postFn.apply(this, arguments);
                return result;
            }
        }
    }
}
