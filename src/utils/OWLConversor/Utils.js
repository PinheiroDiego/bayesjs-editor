window.DEBUG_ENABLED = true;

var ConvertedData = {};

var accentMapping = {
	"â":"a", "Â":"A", "à":"a", "À":"A", "á":"a", "Á":"A", "ã":"a", "Ã":"A",
	"ê":"e", "Ê":"E", "è":"e", "È":"E", "é":"e", "É":"E",
	"î":"i", "Î":"I", "ì":"i", "Ì":"I", "í":"i", "Í":"I",
	"õ":"o", "Õ":"O", "ô":"o", "Ô":"O", "ò":"o", "Ò":"O", "ó":"o", "Ó":"O",
	"ü":"u", "Ü":"U", "û":"u", "Û":"U", "ú":"u", "Ú":"U", "ù":"u", "Ù":"U",
	"ç":"c", "Ç":"C",
	"n":"ñ", "Ñ":"Ñ"
};

window.Utils = {
	debug : DEBUG_ENABLED ? console.warn : function(){},
	
	error : function(errorMessage){
		throw errorMessage;
	},
	
	reset : function(){
		ConvertedData = {};
	},
	
	setConvertedData : function(data){
		ConvertedData = data;
	},
	
	normalizeNodeId : function(value){
		if(!value){
			return null;
		}
		
		return value
			.replace(/#+$/, "")
			.replace(/^#+/, "")
			.replace(/_/g, " ");
	},
	
	getElementId : function(element){
		if(!element){
			return null;
		}
		
		var id = null;
		var originalId = null;
		
		if(element["@IRI"]){
			id = originalId = element["@IRI"];
		}else if(element["@abbreviatedIRI"]){
			originalId = element["@abbreviatedIRI"];
			id = Query.unabbreviateIri(originalId);
		}
		
		return id ? Utils.normalizeNodeId(id) : null;
	},
	
	generateCpt : function(parents){
		var cpt = [];
		var cptCollection = Utils.generateCptCollection(parents);
		
		if(!parents || !parents.length){
			return cptCollection;
		}
		
		for(var x = 0; x < cptCollection.length; x++){
			cpt.push({
				when : cptCollection[x],
				then : {"Sim":0.5, "Não":0.5}
			});
		}
		
		return cpt;
	},
	
	generateCptCollection : function(parents){
		if(!parents || !parents.length){
			// quando não há nó pai, deve ser apenas um objeto com os valores
			return {"Sim":0.5, "Não":0.5};
		}
		
		var cptCollection = [];
		
		for(var x = (Math.pow(2, parents.length)-1) ; x >= 0 ; x--){
			var row = {};
			
			for(var y = parents.length-1 ; y >= 0 ; y--){
				row[parents[y]] = (x & Math.pow(2, y)) ? "Sim" : "Não";
			}
			
			cptCollection.push(row);
		}
		
		return cptCollection;
	},
	
	shouldIgnoreElement : function(id){
		if(!id){
			return true;
		}
		
		var ignoreList = OWLConversor.getIgnoreList();
		for(var x = 0; x < ignoreList.length; x++){
			// os ids devem ficar em minúsculo e sem acentuação para poder fazer a comparação...
			ignoreList[x] = Utils.removeAccents(ignoreList[x].toLowerCase());
		}
		
		return ignoreList.indexOf(Utils.removeAccents(id.toLowerCase())) != -1;
	},
	
	applyDisjoints : function(){
		var data = ConvertedData;
		var disjoints = Query("disjoints");
		var linkingTree = Query("linkingTree");
		var allParents = {};
		var directChildren = {};
		
		function __loadAllParents(){
			allParents = {};
			for(var x = 0; x < data.nodes.length; x++){
				var id = data.nodes[x].id;
				allParents[id] = Utils.getAllParentsFrom(id);
			}
		}
		__loadAllParents();
		
		function __loadDirectChildren(){
			directChildren = {};
			for(var x = 0; x < data.nodes.length; x++){
				var id = data.nodes[x].id;
				directChildren[id] = Utils.getDirectChildren(id);
			}
		}
		__loadDirectChildren();
		
		for(var x = 0; x < disjoints.length; x++){
			var disjoint = disjoints[x];
			var treeChanged = false;
			
			for(var y = 0; y < data.nodes.length; y++){
				var node = data.nodes[y];
				var parents = node.parents;
				
				// se for filho de mais de uma classe disjoint então está errado e precisa deixar só uma
				var intersection = Utils.getIntersection(disjoint, allParents[node.id]);
				if(intersection.length > 1){
					for(var z = 0; z < parents.length; z++){
						var intersectionParents = Utils.getIntersection(disjoint, allParents[parents[z]]);
						if(intersectionParents.length){
							// remove a ligação que tem o EquivalentClasses, pois o SubClassOf tem prioridade
							if(linkingTree[node.id][parents[z]].indexOf("EquivalentClasses") != -1){
								// remove a ligação
								Utils.debug("removing disjoint link (1): " + parents[z] + " > " + node.id);
								data.nodes[y].parents.splice(z, 1);
								treeChanged = true;
							}
						}
					}
				}
			}
			
			if(treeChanged){
				treeChanged = false;
				__loadAllParents();
			}
		}
		
		// remove ligação quando o pai possui ligação para uma classe disjoint...
		// obs: tem que ser separado do primeiro (bloco acima) porque o primeiro remove parents, e esse debaixo tem
		// que trabalhar em cima do resultado do primeiro
		for(var x = 0; x < disjoints.length; x++){
			var disjoint = disjoints[x];
			for(var y = 0; y < data.nodes.length; y++){
				var node = data.nodes[y];
				for(var z = 0; z < directChildren[node.id].length; z++){
					var child = directChildren[node.id][z];
					if(disjoint.indexOf(child) != -1){
						var parentsDisjoints = Utils.getIntersection(disjoint, allParents[node.id]);
						var diff = Utils.getDifference([child], parentsDisjoints);
						if(diff.length > 1){
							Utils.debug("removing disjoint link (2): " + node.id + " > " + child);
							var removePosition = data.nodes[Utils.getNodePosition(child)].parents.indexOf(node.id);
							data.nodes[Utils.getNodePosition(child)].parents.splice(removePosition, 1);
							__loadAllParents();
							__loadDirectChildren();
						}
					}
				}
			}
		}
		
		return data;
	},
	
	removeAccents : function(text){
		return text.replace(/[\W\[\] ]/g, function(value){
			return accentMapping[value] || value;
		});
	},
	
	makeArray : function(node){
		if(!node){
			return [];
		}
		
		if(node.length){
			return node;
		}
		
		return [node];
	},
	
	getDifference : function(array1, array2){
		return array1
			.filter(function(x){
				return array2.indexOf(x) == -1;
			})
			.concat(array2.filter(function(x){
				return array1.indexOf(x) == -1;
			}));
	},
	
	getIntersection : function(array1, array2){
		return array1.filter(function(n){
			return array2.indexOf(n) !== -1;
		});
	},
	
	getUnion : function(array1, array2){
		// junta dois arrays mantendo os valores únicos (sem duplicação)
		var combine = array1.concat(array2);
		return combine.filter(function(value, pos){
			return combine.indexOf(value) == pos;
		});
	},
	
	getNodeById : function(id){
		for(var x = 0; x < ConvertedData.nodes.length; x++){
			if(id == ConvertedData.nodes[x].id){
				return ConvertedData.nodes[x];
			}
		}
		return null;
	},
	
	getNodePosition : function(id){
		for(var x = 0; x < ConvertedData.nodes.length; x++){
			if(id == ConvertedData.nodes[x].id){
				return x;
			}
		}
		return null;
	},
	
	getAllParentsFrom : function(fromId, parents){
		parents = parents || [];
		
		var node = Utils.getNodeById(fromId);
		if(!node){
			return parents;
		}
		
		for(var x = 0; x < node.parents.length; x++){
			if(parents.indexOf(node.parents[x]) == -1){ // se ainda não adicionou na lista de pais...
				parents.push(node.parents[x]);
				Utils.getAllParentsFrom(node.parents[x], parents);
			}
		}
		
		return parents;
	},
	
	getAllChildrenFrom : function(fromId, children){
		children = children || [];
		
		var linkingTree = Query("linkingTree");
		for(var id in linkingTree){
			// se é filho e ainda não adicionou na lista de filhos...
			if(linkingTree[id][fromId] && children.indexOf(id) == -1){
				children.push(id);
				Utils.getAllChildrenFrom(id, children);
			}
		}
		
		return children;
	},
	
	getDirectChildren : function(fromId){ // retorna apenas os filhos DIRETOS do objeto
		var children = [];
		
		var linkingTree = Query("linkingTree");
		for(var id in linkingTree){
			// se é filho e ainda não adicionou na lista de filhos...
			if(linkingTree[id][fromId] && children.indexOf(id) == -1){
				children.push(id);
			}
		}
		
		return children;
	},
	
	hasCircularLink : function(){
		var circularLinkFound = false;
		
		var nodes = ConvertedData.nodes;
		for(var x = 0; x < nodes.length; x++){
			var allParents = Utils.getAllParentsFrom(nodes[x].id);
			var index = allParents.indexOf(nodes[x].id);
			if(index != -1){
				Utils.debug("deep circular link found: " + allParents[index] + " > ... > " + nodes[x].id + " > ...");
				circularLinkFound = true;
			}
		}
		
		return circularLinkFound;
	}
};