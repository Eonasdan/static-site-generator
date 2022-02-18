export default class Utilities {
    static formatter = new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    static log = (message) => {
        console.log(`[Make ${Utilities.formatter.format(new Date())}] ${message}`)
    }
}