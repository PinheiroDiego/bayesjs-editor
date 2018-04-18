const config = require('./config.terms.json');

const accentMapping = {
  â: 'a', Â: 'A', à: 'a', À: 'A', á: 'a', Á: 'A', ã: 'a', Ã: 'A',
  ê: 'e', Ê: 'E', è: 'e', È: 'E', é: 'e', É: 'E',
  î: 'i', Î: 'I', ì: 'i', Ì: 'I', í: 'i', Í: 'I',
  õ: 'o', Õ: 'O', ô: 'o', Ô: 'O', ò: 'o', Ò: 'O', ó: 'o', Ó: 'O',
  ü: 'u', Ü: 'U', û: 'u', Û: 'U', ú: 'u', Ú: 'U', ù: 'u', Ù: 'U',
  ç: 'c', Ç: 'C',
  ñ: 'n', Ñ: 'N',
};

let convertedData = {};
let ignoreList = null;
let removeList = null;

const utils = {
  query: null,

  debug: console ? console.warn : () => {},

  error: (errorMessage) => {
    throw errorMessage;
  },

  reset: () => {
    convertedData = {};
  },

  setConvertedData: (data) => {
    convertedData = data;
  },

  normalizeNodeId: (value) => {
    if (!value) {
      return null;
    }

    return value
      .replace(/#+$/, '')
      .replace(/^#+/, '')
      .replace(/_/g, ' ');
  },

  getElementId: (element) => {
    if (!element) {
      return null;
    }

    let id = null;
    let originalId = null;

    if (element['@IRI']) {
      id = originalId = element['@IRI'];
    } else if (element['@abbreviatedIRI']) {
      originalId = element['@abbreviatedIRI'];
      id = utils.query.unabbreviateIri(originalId);
    }

    return id ? utils.normalizeNodeId(id) : null;
  },

  generateCpt: (parents) => {
    const cpt = [];
    const cptCollection = utils.generateCptCollection(parents);

    if (!parents || !parents.length) {
      return cptCollection;
    }

    cptCollection.forEach((collection) => {
      cpt.push({
        when: collection,
        then: { Sim: 0.5, Não: 0.5 },
      });
    });

    return cpt;
  },

  generateCptCollection: (parents) => {
    if (!parents || !parents.length) {
      // if element doesn't have parent, it should use a simple object containing 'Sim'/'Não'
      return { Sim: 0.5, Não: 0.5 };
    }

    const cptCollection = [];

    // generates all combinations of cpt
    for (let x = (Math.pow(2, parents.length) - 1); x >= 0; x--) {
      const row = {};
      for (let y = parents.length - 1; y >= 0; y--) {
        row[parents[y]] = (x & Math.pow(2, y)) ? 'Sim' : 'Não';
      }

      cptCollection.push(row);
    }

    return cptCollection;
  },

  shouldIgnoreElement: (id) => {
    if (!id) {
      return true;
    }

    return utils.getIgnoreList().indexOf(utils.removeAccents(id.toLowerCase())) !== -1;
  },

  applyDisjoints: () => {
    const data = convertedData;
    const disjoints = utils.query('disjoints');
    const linkingTree = utils.query('linkingTree');
    let allParents = {};
    let directChildren = {};

    const loadAllParents = () => {
      allParents = {};
      data.nodes.forEach((node) => (
        allParents[node.id] = utils.getAllParentsFrom(node.id)
      ));
    };

    const loadDirectChildren = () => {
      directChildren = {};
      data.nodes.forEach((node) => (
        directChildren[node.id] = utils.getDirectChildren(node.id)
      ));
    };

    loadAllParents();
    loadDirectChildren();

    disjoints.forEach((disjoint) => {
      let treeChanged = false;

      data.nodes.forEach((node, y) => {
        // if node has more than one disjoint parent then it must be changed because there
        // can be only one disjoint parent
        if (utils.getIntersection(disjoint, allParents[node.id]).length > 1) {
          node.parents.forEach((parent, z) => {
            if (utils.getIntersection(disjoint, allParents[parent]).length) {
              // remove the linking of type EquivalentClasses because SubClassOf has higher
              // priority
              if (linkingTree[node.id][parent].indexOf('EquivalentClasses') !== -1) {
                utils.debug(`removing disjoint link (1): ${parent} > ${node.id}`);
                data.nodes[y].parents.splice(z, 1);
                treeChanged = true;
              }
            }
          });
        }
      });

      if (treeChanged) {
        treeChanged = false;
        loadAllParents();
      }
    });

    // remove linking when parent is linked to another disjoint class...
    disjoints.forEach((disjoint) => {
      data.nodes.forEach((node) => {
        const id = node.id;

        directChildren[id].forEach((child) => {
          if (disjoint.indexOf(child) === -1) {
            return;
          }

          const parentsDisjoints = utils.getIntersection(disjoint, allParents[id]);
          const diff = utils.getDifference([child], parentsDisjoints);
          if (diff.length > 1) {
            utils.debug(`removing disjoint link (2): ${id} > ${child}`);
            const removePosition = data.nodes[utils.getNodePosition(child)].parents.indexOf(id);
            data.nodes[utils.getNodePosition(child)].parents.splice(removePosition, 1);
            loadAllParents();
            loadDirectChildren();
          }
        });
      });
    });

    return data;
  },

  removeAccents: text => text.replace(/[\W\[\] ]/g, (value) => accentMapping[value] || value),

  makeArray: (node) => {
    if (!node) {
      return [];
    }

    return node.length ? node : [node];
  },

  getDifference: (array1, array2) => (
    array1
      .filter((x) => array2.indexOf(x) === -1)
      .concat(array2.filter((x) => array1.indexOf(x) === -1))
  ),

  getIntersection: (array1, array2) => (
    array1.filter((x) => array2.indexOf(x) !== -1)
  ),

  getUnion: (array1, array2) => {
    const combine = array1.concat(array2);
    return combine.filter((value, pos) => combine.indexOf(value) === pos);
  },

  getNodeById: (id) => convertedData.nodes.filter((node) => id === node.id)[0],

  getNodePosition: (id) => {
    let position = null;

    convertedData.nodes.forEach((node, x) => {
      if (id === convertedData.nodes[x].id) {
        position = x;
        return true;
      }
      return false;
    });

    return position;
  },

  getAllParentsFrom: (fromId, parents = []) => {
    const node = utils.getNodeById(fromId);

    if (!node) {
      return parents;
    }

    node.parents.forEach((parentId) => {
      if (parents.indexOf(parentId) === -1) {
        parents.push(parentId);
        utils.getAllParentsFrom(parentId, parents);
      }
    });

    return parents;
  },

  getAllChildrenFrom: (fromId, children = []) => {
    const linkingTree = utils.query('linkingTree');
    Object.keys(linkingTree).forEach((id) => {
      if (linkingTree[id][fromId] && children.indexOf(id) === -1) {
        children.push(id);
        utils.getAllChildrenFrom(id, children);
      }
    });

    return children;
  },

  // return only DIRECT children
  getDirectChildren: (fromId) => {
    const children = [];

    const linkingTree = utils.query('linkingTree');
    Object.keys(linkingTree).forEach((id) => {
      if (linkingTree[id][fromId] && children.indexOf(id) === -1) {
        children.push(id);
      }
    });

    return children;
  },

  hasCircularLink: () => {
    let circularLinkFound = false;

    convertedData.nodes.forEach((node) => {
      const allParents = utils.getAllParentsFrom(node.id);
      const index = allParents.indexOf(node.id);
      if (index !== -1) {
        utils.debug(`deep circular link found: ${allParents[index]} > ... > ${node.id} > ...`);
        circularLinkFound = true;
      }
    });

    return circularLinkFound;
  },

  getIgnoreList: () => {
    if (ignoreList) {
      return ignoreList;
    }

    if (!config.ignoreElements || !config.ignoreElements.length) {
      return {};
    }

    const ignoreObjTemp = {};
    config.ignoreElements.forEach((element) => {
      ignoreObjTemp[utils.removeAccents(element.toLowerCase())] = true;
    });

    ignoreList = Object.keys(ignoreObjTemp);
    return ignoreList;
  },

  getRemoveList: () => {
    if (removeList) {
      return removeList;
    }

    if (!config.removeElements || !config.removeElements.length) {
      return {};
    }

    const removeObjTemp = {};
    config.removeElements.forEach((element) => {
      removeObjTemp[utils.removeAccents(element.toLowerCase())] = true;
    });

    removeList = Object.keys(removeObjTemp);
    return removeList;
  },
};

module.exports = utils;
