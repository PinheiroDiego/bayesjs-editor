/*
 https://github.com/abdmob/x2js

 Copyright 2011-2013 Abdulla Abdurakhmanov
 Original sources are available at https://code.google.com/p/x2js/

 Licensed under the Apache License, Version 2.0 (the 'License');
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an 'AS IS' BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

(((root, factory) => {
  const X2JS = factory();
  module.exports = X2JS;
})(this, () => (
  function fac(config) {
    const VERSION = '1.2.0';

    config = config || {};

    function initConfigDefaults() {
      if (config.escapeMode === undefined) {
        config.escapeMode = true;
      }

      config.attributePrefix = config.attributePrefix || '_';
      config.arrayAccessForm = config.arrayAccessForm || 'none';
      config.emptyNodeForm = config.emptyNodeForm || 'text';
      if (config.enableToStringFunc === undefined) {
        config.enableToStringFunc = true;
      }
      config.arrayAccessFormPaths = config.arrayAccessFormPaths || [];
      if (config.skipEmptyTextNodesForObj === undefined) {
        config.skipEmptyTextNodesForObj = true;
      }
      if (config.stripWhitespaces === undefined) {
        config.stripWhitespaces = true;
      }
      config.datetimeAccessFormPaths = config.datetimeAccessFormPaths || [];
      if (config.useDoubleQuotes === undefined) {
        config.useDoubleQuotes = false;
      }
      config.xmlElementsFilter = config.xmlElementsFilter || [];
      config.jsonPropertiesFilter = config.jsonPropertiesFilter || [];
      if (config.keepCData === undefined) {
        config.keepCData = false;
      }
    }

    initConfigDefaults();

    const DOMNodeTypes = {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3,
      CDATA_SECTION_NODE: 4,
      COMMENT_NODE: 8,
      DOCUMENT_NODE: 9,
    };

    const getNodeLocalName = (node) => node.localName || node.baseName || node.nodeName;

    const getNodePrefix = (node) => node.prefix;

    const escapeXmlChars = (str) => {
      if (typeof(str) === 'string') {
        return str.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      }

      return str;
    };

    // const unescapeXmlChars = (str) => {
    //   return str.replace(/&lt;/g, '<')
    //     .replace(/&gt;/g, '>')
    //     .replace(/&quot;/g, '"')
    //     .replace(/&apos;/g, "'")
    //     .replace(/&amp;/g, '&');
    // };

    const checkInStdFiltersArrayForm = (stdFiltersArrayForm, obj, name, path) => {
      let idx = 0;
      for (; idx < stdFiltersArrayForm.length; idx++) {
        const filterPath = stdFiltersArrayForm[idx];
        if (typeof filterPath === 'string') {
          if (filterPath === path) {
            break;
          }
        } else if (filterPath instanceof RegExp) {
          if (filterPath.test(path)) {
            break;
          }
        } else if (typeof filterPath === 'function') {
          if (filterPath(obj, name, path)) {
            break;
          }
        }
      }
      return idx !== stdFiltersArrayForm.length;
    };

    const toArrayAccessForm = (obj, childName, path) => {
      switch (config.arrayAccessForm) {
        case 'property':
          if (!(obj[childName] instanceof Array)) {
            obj[`${childName}_asArray`] = [obj[childName]];
          } else {
            obj[`${childName}_asArray`] = obj[childName];
          }
          break;
        /* case 'none':
          break; */
        default:
          break;
      }

      if (!(obj[childName] instanceof Array) && config.arrayAccessFormPaths.length > 0) {
        if (checkInStdFiltersArrayForm(config.arrayAccessFormPaths, obj, childName, path)) {
          obj[childName] = [obj[childName]];
        }
      }
    };

    const fromXmlDateTime = (prop) => {
      // Implementation based up on http://stackoverflow.com/questions/8178598/xml-datetime-to-javascript-date-object
      // Improved to support full spec and optional parts
      const bits = prop.split(/[-T:+Z]/g);

      let d = new Date(bits[0], bits[1] - 1, bits[2]);
      const secondBits = bits[5].split('.');
      d.setHours(bits[3], bits[4], secondBits[0]);
      if (secondBits.length > 1) {
        d.setMilliseconds(secondBits[1]);
      }

      // Get supplied time zone offset in minutes
      if (bits[6] && bits[7]) {
        let offsetMinutes = bits[6] * 60 + Number(bits[7]);
        const sign = /\d\d-\d\d:\d\d$/.test(prop) ? '-' : '+';

        // Apply the sign
        offsetMinutes = 0 + (sign === '-' ? (-1 * offsetMinutes) : offsetMinutes);

        // Apply offset and local timezone
        d.setMinutes(d.getMinutes() - offsetMinutes - d.getTimezoneOffset());
      } else if (prop.indexOf('Z', prop.length - 1) !== -1) {
        d = new Date(Date.UTC(
          d.getFullYear(),
          d.getMonth(),
          d.getDate(),
          d.getHours(),
          d.getMinutes(),
          d.getSeconds(),
          d.getMilliseconds()
        ));
      }

      // d is now a local time equivalent to the supplied time
      return d;
    };

    const checkFromXmlDateTimePaths = (value, childName, fullPath) => {
      if (config.datetimeAccessFormPaths.length > 0) {
        const path = fullPath.split('.#')[0];
        if (checkInStdFiltersArrayForm(config.datetimeAccessFormPaths, value, childName, path)) {
          return fromXmlDateTime(value);
        }
        return value;
      }
      return value;
    };

    const checkXmlElementsFilter = (obj, childType, childName, childPath) => {
      if (childType === DOMNodeTypes.ELEMENT_NODE && config.xmlElementsFilter.length > 0) {
        return checkInStdFiltersArrayForm(config.xmlElementsFilter, obj, childName, childPath);
      }
      return true;
    };

    const parseDOMChildren = (node, path) => {
      let childName;
      if (node.nodeType === DOMNodeTypes.DOCUMENT_NODE) {
        const result = {};
        const nodeChildren = node.childNodes;
        // Alternative for firstElementChild which is not supported in some environments
        for (let cidx = 0; cidx < nodeChildren.length; cidx++) {
          const child = nodeChildren.item(cidx);
          if (child.nodeType === DOMNodeTypes.ELEMENT_NODE) {
            childName = getNodeLocalName(child);
            result[childName] = parseDOMChildren(child, childName);
          }
        }
        return result;
      } else if (node.nodeType === DOMNodeTypes.ELEMENT_NODE) {
        let result = {};
        result.$cnt = 0;

        const nodeChildren = node.childNodes;

        // Children nodes
        for (let cidx = 0; cidx < nodeChildren.length; cidx++) {
          const child = nodeChildren.item(cidx); // nodeChildren[cidx];
          childName = getNodeLocalName(child);

          if (child.nodeType !== DOMNodeTypes.COMMENT_NODE) {
            const childPath = `${path}.${childName}`;
            if (checkXmlElementsFilter(result, child.nodeType, childName, childPath)) {
              result.$cnt++;
              if (!result[childName]) {
                result[childName] = parseDOMChildren(child, childPath);
                toArrayAccessForm(result, childName, childPath);
              } else {
                if (result[childName]) {
                  if (!(result[childName] instanceof Array)) {
                    result[childName] = [result[childName]];
                    toArrayAccessForm(result, childName, childPath);
                  }
                }
                result[childName][result[childName].length] = parseDOMChildren(child, childPath);
              }
            }
          }
        }

        // Attributes
        for (let aidx = 0; aidx < node.attributes.length; aidx++) {
          const attr = node.attributes.item(aidx); // [aidx];
          result.$cnt++;
          result[`${config.attributePrefix}${attr.name}`] = attr.value;
        }

        // Node namespace prefix
        const nodePrefix = getNodePrefix(node);
        if (nodePrefix) {
          result.$cnt++;
          result.$prefix = nodePrefix;
        }

        if (result['#text']) {
          result.$text = result['#text'];
          if (result.$text instanceof Array) {
            result.$text = result.$text.join('\n');
          }
          // if (config.escapeMode)
          //  result.$text = unescapeXmlChars(result.$text);
          if (config.stripWhitespaces) {
            result.$text = result.$text.trim();
          }
          delete result['#text'];
          if (config.arrayAccessForm === 'property') {
            delete result['#text_asArray'];
          }
          result.$text = checkFromXmlDateTimePaths(result.$text, childName, `${path}.${childName}`);
        }
        if (result['#cdata-section']) {
          result.$cdata = result['#cdata-section'];
          delete result['#cdata-section'];
          if (config.arrayAccessForm === 'property') {
            delete result['#cdata-section_asArray'];
          }
        }

        if (result.$cnt === 0 && config.emptyNodeForm === 'text') {
          result = '';
        } else if (result.$cnt === 1 && result.$text) {
          result = result.$text;
        } else if (result.$cnt === 1 && result.$cdata && !config.keepCData) {
          result = result.$cdata;
        } else if (result.$cnt > 1 && result.$text && config.skipEmptyTextNodesForObj) {
          if ((config.stripWhitespaces && result.$text === '') || result.$text.trim() === '') {
            delete result.$text;
          }
        }
        delete result.$cnt;

        if (config.enableToStringFunc && (result.$text || result.$cdata)) {
          result.toString = function toString() {
            return (this.$text ? this.$text : '') + (this.$cdata ? this.$cdata : '');
          };
        }

        return result;
      } else if (node.nodeType === DOMNodeTypes.TEXT_NODE) {
        return node.nodeValue;
      } else if (node.nodeType === DOMNodeTypes.CDATA_SECTION_NODE) {
        return node.nodeValue;
      }
      return undefined;
    };

    const startTag = (jsonObj, element, attrList, closed) => {
      let resultStr = '<';
      resultStr += jsonObj && jsonObj.$prefix ? `${jsonObj.$prefix}:` : '';
      resultStr += element;

      if (attrList) {
        for (let aidx = 0; aidx < attrList.length; aidx++) {
          const attrName = attrList[aidx];
          let attrVal = jsonObj[attrName];
          if (config.escapeMode) {
            attrVal = escapeXmlChars(attrVal);
          }
          resultStr += ` ${attrName.substr(config.attributePrefix.length)}=`;
          if (config.useDoubleQuotes) {
            resultStr += `"${attrVal}"`;
          } else {
            resultStr += `'${attrVal}'`;
          }
        }
      }
      if (!closed) {
        resultStr += '>';
      } else {
        resultStr += '/>';
      }
      return resultStr;
    };

    const endTag = (jsonObj, elementName) => {
      let result = '</';
      result += jsonObj.$prefix ? `${jsonObj.$prefix}:` : '';
      result += elementName;
      result += '>';
      return result;
    };

    const endsWith = (str, suffix) => str.indexOf(suffix, str.length - suffix.length) !== -1;

    const jsonXmlSpecialElem = (jsonObj, jsonObjField) => {
      const field = jsonObjField.toString();
      if ((config.arrayAccessForm === 'property' && endsWith(field, ('_asArray')))
          || jsonObjField.toString().indexOf(config.attributePrefix) === 0
          || jsonObjField.toString().indexOf('__') === 0
          || (jsonObj[jsonObjField] instanceof Function)) {
        return true;
      }
      return false;
    };

    const jsonXmlElemCount = (jsonObj) => {
      let elementsCnt = 0;
      if (jsonObj instanceof Object) {
        Object.keys(jsonObj).forEach((it) => {
          if (jsonXmlSpecialElem(jsonObj, it)) {
            return;
          }
          elementsCnt++;
        });
      }
      return elementsCnt;
    };

    const checkJsonObjPropertiesFilter = (jsonObj, propertyName, jsonObjPath) => (
      config.jsonPropertiesFilter.length === 0
        || jsonObjPath === ''
        || checkInStdFiltersArrayForm(
          config.jsonPropertiesFilter, jsonObj, propertyName, jsonObjPath
        )
    );

    const parseJSONAttributes = (jsonObj) => {
      const attrList = [];
      if (jsonObj instanceof Object) {
        Object.keys(jsonObj).forEach((ait) => {
          if (ait.toString().indexOf('__') === -1) {
            if (ait.toString().indexOf(config.attributePrefix) === 0) {
              attrList.push(ait);
            }
          }
        });
      }
      return attrList;
    };

    const parseJSONTextAttrs = (jsonTxtObj) => {
      let result = '';

      if (jsonTxtObj.$cdata) {
        result += `<![CDATA[${jsonTxtObj.$cdata}]]>`;
      }

      if (jsonTxtObj.$text) {
        if (config.escapeMode) {
          result += escapeXmlChars(jsonTxtObj.$text);
        } else {
          result += jsonTxtObj.$text;
        }
      }
      return result;
    };

    const parseJSONTextObject = (jsonTxtObj) => {
      let result = '';

      if (jsonTxtObj instanceof Object) {
        result += parseJSONTextAttrs(jsonTxtObj);
      } else if (jsonTxtObj) {
        if (config.escapeMode) {
          result += escapeXmlChars(jsonTxtObj);
        } else {
          result += jsonTxtObj;
        }
      }

      return result;
    };

    const getJsonPropertyPath = (jsonObjPath, jsonPropName) => {
      if (jsonObjPath === '') {
        return jsonPropName;
      }

      return `${jsonObjPath}.${jsonPropName}`;
    };

    let parseJSONObject = null;
    const parseJSONArray = (jsonArrRoot, jsonArrObj, attrList, jsonObjPath) => {
      let result = '';
      if (jsonArrRoot.length === 0) {
        result += startTag(jsonArrRoot, jsonArrObj, attrList, true);
      } else {
        jsonArrRoot.forEach((item) => {
          result += startTag(item, jsonArrObj, parseJSONAttributes(item), false);
          result += parseJSONObject(item, getJsonPropertyPath(jsonObjPath, jsonArrObj));
          result += endTag(item, jsonArrObj);
        });
      }
      return result;
    };

    parseJSONObject = (jsonObj, jsonObjPath) => {
      let result = '';

      const elementsCnt = jsonXmlElemCount(jsonObj);

      if (elementsCnt > 0) {
        Object.keys(jsonObj).forEach((it) => {
          if (jsonXmlSpecialElem(jsonObj, it)
              || (jsonObjPath && !checkJsonObjPropertiesFilter(
                jsonObj, it, getJsonPropertyPath(jsonObjPath, it)))
              ) {
            return;
          }

          const subObj = jsonObj[it];
          const attrList = parseJSONAttributes(subObj);

          if (!subObj) {
            result += startTag(subObj, it, attrList, true);
          } else if (subObj instanceof Object) {
            if (subObj instanceof Array) {
              result += parseJSONArray(subObj, it, attrList, jsonObjPath);
            } else if (subObj instanceof Date) {
              result += startTag(subObj, it, attrList, false);
              result += subObj.toISOString();
              result += endTag(subObj, it);
            } else {
              const subObjElementsCnt = jsonXmlElemCount(subObj);
              if (subObjElementsCnt > 0 || subObj.$text || subObj.$cdata) {
                result += startTag(subObj, it, attrList, false);
                result += parseJSONObject(subObj, getJsonPropertyPath(jsonObjPath, it));
                result += endTag(subObj, it);
              } else {
                result += startTag(subObj, it, attrList, true);
              }
            }
          } else {
            result += startTag(subObj, it, attrList, false);
            result += parseJSONTextObject(subObj);
            result += endTag(subObj, it);
          }
        });
      }
      result += parseJSONTextObject(jsonObj);

      return result;
    };

    this.parseXmlString = function parseXmlString(xmlDocStr) {
      const isIEParser = window.ActiveXObject || 'ActiveXObject' in window;
      if (xmlDocStr === undefined) {
        return null;
      }
      let xmlDoc;
      const parser = new window.DOMParser();
      let parsererrorNS = null;
      if (!isIEParser) {
        try {
          parsererrorNS = parser.parseFromString('INVALID', 'text/xml')
            .getElementsByTagName('parsererror')[0].namespaceURI;
        } catch (err) {
          parsererrorNS = null;
        }
      }
      try {
        xmlDoc = parser.parseFromString(xmlDocStr, 'text/xml');
        const el = xmlDoc.getElementsByTagNameNS(parsererrorNS, 'parsererror');
        if (parsererrorNS && el.length > 0) {
          // throw new Error('Error parsing XML: '+xmlDocStr);
          xmlDoc = null;
        }
      } catch (err) {
        xmlDoc = null;
      }
      return xmlDoc;
    };

    this.asArray = function asArray(prop) {
      if (!prop) {
        return [];
      } else if (prop instanceof Array) {
        return prop;
      }
      return [prop];
    };

    this.toXmlDateTime = function toXmlDateTime(dt) {
      if (dt instanceof Date) {
        return dt.toISOString();
      } else if (typeof(dt) === 'number') {
        return new Date(dt).toISOString();
      }
      return null;
    };

    this.asDateTime = function asDateTime(prop) {
      if (typeof(prop) === 'string') {
        return fromXmlDateTime(prop);
      }
      return prop;
    };

    this.xml2json = function xml2json(xmlDoc) {
      return parseDOMChildren(xmlDoc);
    };

    this.xmlStr2Json = function xmlStr2Json(xmlDocStr) {
      const xmlDoc = this.parseXmlString(xmlDocStr);
      if (xmlDoc) {
        return this.xml2json(xmlDoc);
      }
      return null;
    };

    this.json2XmlStr = function json2XmlStr(jsonObj) {
      return parseJSONObject(jsonObj, '');
    };

    this.json2xml = function json2xml(jsonObj) {
      return this.parseXmlString(this.json2XmlStr(jsonObj));
    };

    this.getVersion = function getVersion() {
      return VERSION;
    };
  }
)));
