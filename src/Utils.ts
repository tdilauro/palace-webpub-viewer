import BookResourceStore from "BookResourceStore";
import Encryption from "./Encryption";
import Decryptor from "./Decryptor";

type xmlObject = {
  [key: string]: string[] | string | xmlObject | [];
};

export function xmlToJson(xml: any) {
  let obj = {} as xmlObject;

  // process ELEMENT_NODE
  if (xml.nodeType == 1) {
    if (xml.attributes.length > 0) {
      obj["@attributes"] = {};
      for (let j = 0; j < xml.attributes.length; j++) {
        const attribute = xml.attributes.item(j);
        obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
      }
    }
  }
  // process TEXT_NODE
  else if (xml.nodeType == 3) {
    obj = xml.nodeValue;
  }

  if (xml.hasChildNodes()) {
    for (let i = 0; i < xml.childNodes.length; i++) {
      const item = xml.childNodes.item(i);
      //strip special characters from nodeName
      const nodeName: string = item.nodeName;

      if (typeof obj[nodeName] == "undefined") {
        obj[nodeName] = xmlToJson(item);
      } else {
        //@ts-ignore
        if (typeof obj[nodeName].push == "undefined") {
          const old = obj[nodeName];
          obj[nodeName] = [];
          //@ts-ignore
          obj[nodeName].push(old);
        }
        //@ts-ignore
        obj[nodeName].push(xmlToJson(item));
      }
    }
  }
  return obj;
}

/*
Convert a string into an ArrayBuffer
from https://developers.google.com/web/updates/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
*/
export function ab2str(buf: Iterable<number>) {
  var decoder = new TextDecoder("utf-8");
  return decoder.decode(new Uint8Array(buf));
}

/* Replace image assets in XML document with local or decrypted assets, if applicable*/
export async function embedImageAssets(
  unembeddedXml: string,
  localResource: string,
  store: BookResourceStore,
  encryption?: Encryption,
  decryptor?: Decryptor
) {
  const images =
    unembeddedXml.match(
      /(src="|href=")(?!https?:\/\/)\/?([^"]+\.(jpe?g|png|gif|bmp)")/g
    ) || [];

  for (let image of images) {
    // extract only the path and filename of image
    let srcImg = image.replace(/(src="|href=")/g, "").replace(/['"]+/g, "");
    // resolve to absolute url
    let imgUrl = new URL(srcImg, localResource);
    const resource = await store.getBookData(imgUrl.href);
    let imageUrl;
    if (encryption && decryptor && encryption.isEncrypted(imgUrl.href)) {
      imageUrl = await encryption.getDecryptedUrl(resource.data, decryptor);
    } else {
      if(!resource.data) { 
        throw new Error("This resource has no data object.  Check resource parameters");
      }
      let imageBlob = await resource.data;
      imageUrl = URL.createObjectURL(imageBlob);
    }
    /*replace relative url in XML document with base64 version of image*/
    unembeddedXml = unembeddedXml.replace(image, `${"src=" + imageUrl}`);
  }
  return unembeddedXml;
}

/* Replace css assets in XML document with local or decrypted assets, if applicable*/
export async function embedCssAssets(
  unembeddedXml: string,
  resourcePath: string,
  store: BookResourceStore,
  encryption?: Encryption,
  decryptor?: Decryptor
) {
  const styles = unembeddedXml.match(/(href=")(?!https?:\/\/)\/?([^"]+\.(css))"/g) || [];
  for (let style of styles) { 
    // extract only the path and filename of stylesheet
    let relativeUrl = style.replace("href=", "").replace(/['"]+/g, "");
    // resolve to absolute url
    let styleUrl = new URL(relativeUrl, resourcePath);
    const resource = await store.getBookData(styleUrl.href);

    let cssUrl;
    if (encryption && decryptor && encryption.isEncrypted(styleUrl.href)) {
      cssUrl = await encryption.getDecryptedUrl(resource.data, decryptor);
    } else {
      cssUrl = URL.createObjectURL(resource.data);
    }
    let replacement = "href=" + cssUrl;
    unembeddedXml = unembeddedXml.replace(style, `${replacement}`);
  }
  return unembeddedXml;
}