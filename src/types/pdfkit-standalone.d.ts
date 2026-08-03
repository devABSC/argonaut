/**
 * The standalone build has no types of its own. It is the same class as the
 * typed default export — only the font metrics are bundled rather than read
 * from disk, which is what makes it work on serverless.
 */
declare module "pdfkit/js/pdfkit.standalone.js" {
  import PDFDocument from "pdfkit";
  export default PDFDocument;
}
