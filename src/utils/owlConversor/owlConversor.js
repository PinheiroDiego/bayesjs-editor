import X2JS from './xml2json';
import utils from './utils';
import query from './query';

utils.query = query;
query.utils = utils;

const x2js = new X2JS({
  attributePrefix: '@',
});

const fn = {
  convert: (ontology) => {
    utils.reset();
    query.reset();
    query.setData(ontology);

    let convertedData = fn.getDefaultProperties();

    convertedData.network.name = query('owlName');
    convertedData.nodes = query('nodes');

    utils.setConvertedData(convertedData);
    convertedData = utils.applyDisjoints();

    // add cpt only after removing unnecessary elements otherwise there would be extra cpt
    convertedData.nodes.forEach((node) => {
      node.cpt = utils.generateCpt(node.parents);
    });

    convertedData.positions = query('positions', convertedData.nodes);

    const maxObjectsPerRow = 5;
    const nodesLength = convertedData.nodes.length;
    convertedData.network.height = Math.ceil(nodesLength / maxObjectsPerRow) * 145;

    // reconfigure data so it can be used by getNodeById
    utils.setConvertedData(convertedData);

    return fn.validateConvertedData(convertedData) ? convertedData : null;
  },

  getDefaultProperties: () => {
    const defaultProperties = {
      version: 2,
      network: {
        width: 1200, // width is always 1200 (= 5 columns)
        height: 100, // height will be calculated according to the amount of rows
        selectedNodes: [],
        beliefs: {},
        propertiesPanelVisible: true,
      },
      nodes: [],
      positions: [],
    };
    return defaultProperties;
  },

  validateConvertedData: (data) => {
    try {
      if (!data.nodes.length) {
        throw Error('Error: no classes were found in this file.');
      }

      if (utils.hasCircularLink()) {
        throw Error('Error: circular link was found but it does not work in editor.');
      }

      return true;
    } catch (ex) {
      utils.debug(ex);
      alert(ex);
    }
    return false;
  },
};

module.exports = {
  convertFromString: (content) => {
    try {
      const json = x2js.xmlStr2Json(content);
      if (json && json.Ontology) {
        return fn.convert(json.Ontology);
      }

      throw Error('File is not an ontology!');
    } catch (ex) {
      utils.debug('Error', ex);
      alert(ex);
    }
    return null;
  },
};
