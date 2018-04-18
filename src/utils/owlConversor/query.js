let Data = null;

let LinkingTree = null;

// parent tree (child < parent)
let ParentTree = null;

// store all objects (classes) created with Declaration or which were used to make links
let DeclarationsMapping = {};

// store all annotations which later will be used to translate AbbreviatedIRI
let AnnotationAssertionMapping = {};

// store the negative linkings ('NOT'), which are linkings which can not exist
let ObjectComplementOfMapping = {};

// elements which were removed and shouldn't appear in the network
let UnnecessaryNodesMapping = [];

let queryFunctions = {};

const query = (key, params) => {
  if (!queryFunctions[key]) {
    query.utils.error(`Unkown information: ${key}`);
  }

  return Data ? queryFunctions[key].call(queryFunctions, params) : null;
};

query.reset = () => {
  Data = null;
  LinkingTree = null;
  ParentTree = null;
  DeclarationsMapping = {};
  AnnotationAssertionMapping = {};
  ObjectComplementOfMapping = {};
  UnnecessaryNodesMapping = [];
};

query.prepare = () => {
  query('linkingTree');
  query.removeUnnecessaryNodes();
  query.normalizeLinkingTree();
};

query.setData = (data) => {
  Data = data;

  // map all AbbreviatedIRI for better performance and also to be simpler when translating them
  query.utils.makeArray(Data.AnnotationAssertion).forEach((element) => {
    if (!element.AbbreviatedIRI || element.AnnotationProperty['@abbreviatedIRI'] !== 'rdfs:label') {
      return;
    }

    if (element.Literal) {
      AnnotationAssertionMapping[element.AbbreviatedIRI] = element.Literal.toString();
    }
  });

  query.prepare();
};

query.normalizeLinkingTree = () => {
  const objectComplementOfMapping = query('objectComplementOfMapping');
  const ignoreList = query.utils.getIgnoreList();

  Object.keys(LinkingTree).forEach((id) => {
    // clear the linking tree according to the terms which should be ignored and switch them
    // with their children, e.g.:
    // A > B > C, if B should be ignored it will result in A > C
    (() => {
      const children = query.utils.getDirectChildren(id);
      const parents = LinkingTree[id];

      if (!query.utils.shouldIgnoreElement(id)) {
        return;
      }

      children.forEach((childId) => {
        // remove the linking which defined it as the parent
        delete LinkingTree[childId][id];

        // turn A > B > C into A > C
        Object.keys(parents).forEach((parent) => {
          if (!LinkingTree[childId][parent]) {
            LinkingTree[childId][parent] = parents[parent];
          }
        });
      });

      // the element doesn't have children anymore so remove it from the linkingTree
      delete LinkingTree[id];
    })();

    // apply the ObjectComplementOf elements which indicate which linking should not exist
    if (objectComplementOfMapping[id]) {
      Object.keys(LinkingTree[id]).forEach((parent) => {
        if (objectComplementOfMapping[id].indexOf(parent) !== -1) {
          delete LinkingTree[id][parent];
        }
      });
    }
  });

  // remove linkings referencing classes which are in the ignore list
  Object.keys(LinkingTree).forEach((id) => {
    Object.keys(LinkingTree[id] || {}).forEach((parent) => {
      const normalizedParent = query.utils.removeAccents(parent.toLowerCase());
      if (ignoreList.indexOf(normalizedParent) !== -1) {
        delete LinkingTree[id][parent];
      }
    });

    if (!Object.keys(LinkingTree[id]).length) {
      delete LinkingTree[id];
    }
  });
};

query.removeUnnecessaryNodes = () => {
  const removeList = query.utils.getRemoveList();

  // if 'id' is in removeList then the element and all its children must be removed
  Object.keys(LinkingTree).forEach((id) => {
    if (removeList.indexOf(query.utils.removeAccents(id.toLowerCase())) === -1) {
      return;
    }

    query.utils.getAllChildrenFrom(id).forEach((childId) => {
      UnnecessaryNodesMapping[childId] = true;
      delete(LinkingTree[childId]);
    });

    UnnecessaryNodesMapping[id] = true;
    delete LinkingTree[id];
  });
};

query.unabbreviateIri = (abbreviatedIRI) => (
  AnnotationAssertionMapping[abbreviatedIRI] || abbreviatedIRI
);

if (!query.utils) {
  query.utils = {};
}

queryFunctions = {
  owlName: () => {
    let name = null;

    Data.Prefix.some((item) => {
      if (item['@name'] === '') {
        const iri = query.utils.getElementId(item).split('/');
        name = query.utils.normalizeNodeId(iri[iri.length - 1]);
        return true;
      }
      return false;
    });

    if (!name) {
      query.utils.error('Information not found: Ontology/Prefix@name=""@IRI');
    }

    return name;
  },

  nodes: () => {
    const linkingTree = query('linkingTree');
    const parentTree = query('parentTree');
    const nodes = [];

    const add = (id) => {
      if (DeclarationsMapping[id] || UnnecessaryNodesMapping[id]) {
        return;
      }

      DeclarationsMapping[id] = true;
      nodes.push({
        id,
        states: ['Sim', 'Não'],
        parents: parentTree[id] || [],
      });
    };

    query.utils.makeArray(Data.Declaration).forEach((declaration) => {
      const id = query.utils.getElementId(declaration.Class);

      if (!id) {
        return;
      }

      if (query.utils.shouldIgnoreElement(id)) {
        query.utils.debug(`ignoring element >>> ${id}`);
        return;
      }

      add(id);
    });

    Object.keys(linkingTree).forEach((childId) => {
      if (!DeclarationsMapping[childId]) {
        add(childId);
      }

      Object.keys(linkingTree[childId]).forEach((parentId) => {
        if (!DeclarationsMapping[parentId]) {
          add(parentId);
        }
      });
    });

    return nodes;
  },

  positions: (nodes) => {
    const positions = {};
    const posXInitial = 60;
    let posX = 0;
    let posY = 50;

    (nodes || []).forEach((node, x) => {
      posX = posX ? (posX + 230) : posXInitial;

      const maxObjectsPerRow = 5;
      if (x > 0 && (x % maxObjectsPerRow) === 0) {
        posX = posXInitial;
        posY += 140;
      }

      positions[node.id] = {
        x: posX,
        y: posY,
      };
    });

    return positions;
  },

  disjoints: () => {
    const disjoints = [];

    query.utils.makeArray(Data.DisjointClasses).forEach((disjoint) => {
      const item = [];
      query.utils.makeArray(disjoint.Class).forEach((element) => {
        item.push(query.utils.getElementId(element));
      });

      disjoints.push(item);
    });

    return disjoints;
  },

  linkingTree: () => {
    if (LinkingTree) {
      return LinkingTree;
    }

    LinkingTree = {};

    // list of elements which indicate linkings between classes;
    // the order is important because it defines the priority;
    // ps: SubClassOf has higher priority then EquivalentClasses
    const linkingElements = [
      'SubClassOf', 'EquivalentClasses', 'ObjectIntersectionOf', 'ObjectUnionOf',
      'ObjectSomeValuesFrom', 'ObjectHasValue',
      'ObjectComplementOf', // **NOT**
    ];

    const add = (linkingType, parentId, childId) => {
      // prevent circular linking (when parent is linked to a child, and the child to its parent)
      if (LinkingTree[parentId] && LinkingTree[parentId][childId]) {
        query.utils.debug('skipping circular link (1)', `${parentId} > ${childId}`);
        return;
      }

      if (typeof LinkingTree[childId] === 'undefined') {
        LinkingTree[childId] = {};
      }

      if (LinkingTree[childId][parentId]) {
        query.utils.debug('skipping duplicated link (1)', `${parentId} > ${childId}`);
        return;
      }

      LinkingTree[childId][parentId] = linkingType;
    };

    const parse = (linkingType, nodes, childId) => {
      Object.keys(nodes).forEach((elementType) => {
        const node = nodes[elementType];

        if (elementType.toLowerCase() === 'class') { // Class
          let parentId = null;

          query.utils.makeArray(node).forEach((element) => {
            parentId = query.utils.getElementId(element);

            if (childId === parentId) {
              return;
            }

            if (linkingType.indexOf('ObjectComplementOf') !== -1) {
              if (typeof ObjectComplementOfMapping[childId] === 'undefined') {
                ObjectComplementOfMapping[childId] = [];
              }
              ObjectComplementOfMapping[childId].push(parentId);
            } else {
              add(linkingType, parentId, childId);
            }
          });
        } else if (linkingElements.indexOf(elementType) !== -1) {
          // loop through the elements which define the linkings
          // ps: it must be in a recursive way because there's no limit in depth; there are
          // cases with 6 levels of depth (Nausea.owl) but probably there are even more; so
          // with recursivity we can find linkings in any depth
          query.utils.makeArray(node).forEach((element) => {
            const linkinTypeForElement = linkingType.slice(); // copy data to a new array
            linkinTypeForElement.push(elementType);
            parse(linkinTypeForElement, element, childId);
          });
        }
      });
    };

    linkingElements.forEach((linkingElement) => {
      query.utils.makeArray(Data[linkingElement]).forEach((element) => {
        parse(
          [linkingElement],
          element,
          query.utils.getElementId(query.utils.makeArray(element.Class)[0])
        );
      });
    });

    return LinkingTree;
  },

  parentTree: () => {
    if (ParentTree) {
      return ParentTree;
    }

    ParentTree = {};

    Object.keys(query('linkingTree')).forEach((childId) => {
      ParentTree[childId] = Object.keys(LinkingTree[childId]);
    });

    return ParentTree;
  },

  objectComplementOfMapping: () => (
    // return only a COPY of the object
    JSON.parse(JSON.stringify(ObjectComplementOfMapping))
  ),
};

module.exports = query;
