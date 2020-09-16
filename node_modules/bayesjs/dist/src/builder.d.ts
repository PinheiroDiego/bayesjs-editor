import { INetwork, INode } from './types';
/**
 * Adds a node to a Bayesian Network
 *
 * @param {Object} network - The Bayesian Network to add the node
 * @param {Object} node - The node to be added
 * @param {String} node.id - The node id
 * @param {String[]} node.parents - The ids of the node parents or empty array
 * @param {String[]} node.states - The states of the node
 * @param {Object} node.cpt - The node conditional probability table.
 * When the node has no parents, it's an object with keys = states and values = probabilities.
 * When the node has parents, it's an array of objects containing two properties: when and then.
 * The property when is an object with keys = parent id and values = parents state.
 * The property then is an object of the same shape as the case when the node has no parents.
 *
 * @returns {Object} Bayesian Network with node added
 */
export declare const addNode: (network: INetwork, node: INode) => INetwork;
