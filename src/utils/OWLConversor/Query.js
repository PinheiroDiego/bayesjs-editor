(function(){
	var Data = null;
	
	// árvore de ligações
	var LinkingTree = null;
	
	// árvore de relacionamentos filho < pais
	var ParentTree = null;
	
	// armazena os objetos criados com Declaration ou que foram referenciados em ligações
	var DeclarationsMapping = {};
	
	// mapeia as anotações, que posteriormente serão utilizadas para traduzir os AbbreviatedIRI
	var AnnotationAssertionMapping = {};
	
	// mapeia as ligações NEGATIVAS ("NOT"), ou seja, que não podem existir
	var ObjectComplementOfMapping = {};
	
	// lista com os elementos removidos pois não são necessários (e não devem aparecer na rede)
	var unnecessaryNodesMapping = [];
	
	window.Query = function(key, params){
		if(!_query[key]){
			Utils.error("Informação desconhecida: " + key);
		}
		
		return Data ? _query[key].call(_query, params) : null;
	};
	
	window.Query.reset = function(){
		Data = null;
		LinkingTree = null;
		ParentTree = null;
		DeclarationsMapping = {};
		AnnotationAssertionMapping = {};
		ObjectComplementOfMapping = {};
	};
	
	window.Query.prepare = function(){
		// chama as funções que montam a árvore de ligações e depois a limpa de acordo com os termos
		Query("linkingTree");
		Query.removeUnnecessaryNodes();
		Query.normalizeLinkingTree();
	},
	
	window.Query.setData = function(data){
		Data = data;
		
		// mapeia os AbbreviatedIRI para não ter problemas com performance e também para
		// ficar simples de fazer a tradução dos nomes
		var annotationAssertionElements = Utils.makeArray(Data.AnnotationAssertion);
		for(var x = 0; x < annotationAssertionElements.length; x++){
			var element = annotationAssertionElements[x];
			
			if(!element.AbbreviatedIRI || !element.Literal || element.AnnotationProperty["@abbreviatedIRI"] != "rdfs:label"){
				continue;
			}
			
			AnnotationAssertionMapping[element.AbbreviatedIRI] = element.Literal.__text;
		}
		
		Query.prepare();
	};
	
	window.Query.normalizeLinkingTree = function(){
		var objectComplementOfMapping = Query("objectComplementOfMapping");
		var ignoreList = OWLConversor.getIgnoreList();
		
		for(var id in LinkingTree){
			// limpa a árvore de ligações de acordo com os termos que devem ser ignorados, passando as
			// ligações que ele tiver para seus filhos. Exemplo:
			// A > B > C, sendo que B deve ser ignorado, ficará: A > C
			(function(){
				var children = Utils.getDirectChildren(id);
				var parents = LinkingTree[id];
				
				if(Utils.shouldIgnoreElement(id)){
					for(var x = 0; x < children.length; x++){
						// remove a ligação que tornava o elemento pai de outro elemento, ou seja,
						// diz que o elemento não é mais pai
						delete LinkingTree[children[x]][id];
						
						// copia os pais do elemento para os filhos, ou seja, transforma o A > B > C em A > C
						for(var parent in parents){
							if(!LinkingTree[children[x]][parent]){
								LinkingTree[children[x]][parent] = parents[parent];
							}
						}
					}
					
					// remove o elemento da árvore de ligações pois todas suas ligações foram passadas direto para seus filhos
					delete LinkingTree[id];
				}
			})();
			
			// trata os ObjectComplementOf, que indicam quais ligações NÃO podem existir
			if(objectComplementOfMapping[id]){
				var parents = LinkingTree[id];
				for(var parent in parents){
					if(objectComplementOfMapping[id].indexOf(parent) != -1){
						delete LinkingTree[id][parent]
					}
				}
			}
		}
		
		// remove as ligações que referenciam classes que devem ser ignoradas
		for(var id in LinkingTree){
			var parents = LinkingTree[id] || {};
			for(var parent in parents){
				if(ignoreList.indexOf(Utils.removeAccents(parent.toLowerCase())) != -1){
					delete LinkingTree[id][parent];
				}
			}
			
			if(!Object.keys(LinkingTree[id]).length){
				delete LinkingTree[id];
			}
		}
	};
	
	window.Query.removeUnnecessaryNodes = function(){
		var removeList = OWLConversor.getRemoveList();
		var objectComplementOfMapping = Query("objectComplementOfMapping");
		
		// remove os elementos e todos os seus filhos caso seja uma das classe listadas em removeList
		for(var id in LinkingTree){
			if(removeList.indexOf(Utils.removeAccents(id.toLowerCase())) == -1){
				continue;
			}
			
			var children = Utils.getAllChildrenFrom(id);
			for(var x = 0; x < children.length; x++){
				unnecessaryNodesMapping[children[x]] = true;
				delete(LinkingTree[children[x]]);
			}
			
			unnecessaryNodesMapping[id] = true;
			delete LinkingTree[id];
		}
	};
	
	window.Query.unabbreviateIri = function(abbreviatedIRI){
		return AnnotationAssertionMapping[abbreviatedIRI] || abbreviatedIRI;
	};
	
	var _query = {
		owlName : function(){
			var name = null;
			
			for(var x = 0; x < Data.Prefix.length; x++){
				if(Data.Prefix[x]["@name"] == ""){
					var iri = Utils.getElementId(Data.Prefix[x]).split("/");
					name = Utils.normalizeNodeId(iri[iri.length - 1]);
					break;
				}
			}
			
			if(!name){
				Utils.error("Informação não encontrada: Ontology/Prefix@name=''@IRI");
			}
			
			return name;
		},
		
		nodes : function(){
			var linkingTree = Query("linkingTree");
			var parentTree = Query("parentTree");
			var nodes = [];
			
			function __add(id){
				if(DeclarationsMapping[id] || unnecessaryNodesMapping[id]){
					return;
				}
				
				DeclarationsMapping[id] = true;
				nodes.push({
					id : id,
					states : ["Sim", "Não"],
					parents : parentTree[id] || []
				});
			}
			
			var declarations = Utils.makeArray(Data.Declaration);
			for(var x = 0; x < declarations.length; x++){
				var element = declarations[x].Class;
				var id = Utils.getElementId(element);
				
				if(!id){
					continue;
				}
				
				if(Utils.shouldIgnoreElement(id)){
					Utils.debug("ignoring element >>> " + id);
					continue;
				}
				
				__add(id);
			}
			
			var linkingTree = Query("linkingTree");
			for(var childId in linkingTree){
				if(!DeclarationsMapping[childId]){
					__add(childId);
				}
				
				for(var parentId in linkingTree[childId]){
					if(!DeclarationsMapping[parentId]){
						__add(parentId);
					}
				}
			}
			
			return nodes;
		},
		
		positions : function(nodes){
			var positions = {};
			
			var posXInitial = 60;
			var posX = 0;
			var posY = 50;
			for(var x = 0; x < (nodes||[]).length; x++){
				posX = posX ? (posX + 230) : posXInitial;
				
				if(x > 0 && (x%MAX_OBJECTS_PER_ROW) == 0){
					posX = posXInitial;
					posY += 140;
				}
				
				positions[nodes[x].id] = {x:posX, y:posY};
			}
			
			return positions;
		},
		
		disjoints : function(){
			var disjoints = [];
			
			var disjointClasses = Utils.makeArray(Data.DisjointClasses);
			for(var x = 0; x < disjointClasses.length; x++){
				var item = [];
				var elements = Utils.makeArray(disjointClasses[x].Class);
				for(var y = 0; y < elements.length; y++){
					item.push(Utils.getElementId(elements[y]));
				}
				disjoints.push(item);
			}
			
			return disjoints;
		},
		
		linkingTree : function(){
			if(LinkingTree){
				return LinkingTree;
			}
			
			LinkingTree = {};
			
			// lista de elementos que podem criar ligaçoes entre os objetos;
			// a ordem dessa lista é importante pois também significa prioridade na hora de
			// evitar ligações circulares, onde o elemento A está ligado ao B, e o B ligado ao A;
			// atualmente, a única prioridade realmente definida é:
			//  - ligações de SubClassOf deve ter prioridade sobre ligações de EquivalentClasses
			var linkingElements = [
				"SubClassOf", "EquivalentClasses", "ObjectIntersectionOf", "ObjectUnionOf",
				"ObjectSomeValuesFrom", "ObjectHasValue",
				"ObjectComplementOf" // **NOT**
			];
			
			function __add(linkingType, parentId, childId){
				// verificação para evitar ligações "circulares" (onde o pai está ligado ao filho, e o filho ao pai);
				// se o pai já tiver ligação para o filho, a nova ligação (do filho com pai) deve ser ignorada
				if(LinkingTree[parentId] && LinkingTree[parentId][childId]){
					return Utils.debug("skipping circular link (1)", parentId + " > " + childId);
				}
				
				if(typeof LinkingTree[childId] == "undefined"){
					LinkingTree[childId] = {};
				}else if(LinkingTree[childId][parentId]){
					Utils.debug("skipping duplicated link (1)", parentId + " > " + childId);
					return;
				}
				
				LinkingTree[childId][parentId] = linkingType;
			};
			
			function __parse(linkingType, nodes, childId){
				for(var elementType in nodes){
					var node = nodes[elementType];
					if(!nodes.hasOwnProperty(elementType)){
						continue;
					}
					
					// se for um elemento do tipo "Class", ele deve ser adicionado na árvore de nós
					if(elementType.toLowerCase() == "class"){ // Class
						var elements = Utils.makeArray(node);
						var parentId;
						
						for(var x = 0; x < elements.length; x++){
							parentId = Utils.getElementId(elements[x]);
							
							if(childId == parentId){
								continue;
							}
							
							if(linkingType.indexOf("ObjectComplementOf") != -1){
								if(typeof ObjectComplementOfMapping[childId] == "undefined"){
									ObjectComplementOfMapping[childId] = [];
								}
								ObjectComplementOfMapping[childId].push(parentId);
							}else{
								__add(linkingType, parentId, childId);
							}
						}
					}else if(linkingElements.indexOf(elementType) != -1){
						// caso o elemento esteja na lista de elementos que criam ligações, ele deve ser
						// percorrido para ir encontrando as classes que formam ligações
						// obs: deve funcionar de forma recursiva porque não existe um limite, há casos em
						// que há ligações de 6 níveis de elementos (Nausea.owl), e talvez tenha até mais do que isso, então
						// fazendo de forma recursiva vai funcionar em qualquer caso, isto é, vai funcionar para qualquer
						// profundidade de ligações;
						var elements = Utils.makeArray(node);
						for(var x = 0; x < elements.length; x++){
							var linkinTypeForElement = linkingType.slice(); // copia os dados para um novo array
							linkinTypeForElement.push(elementType);
							__parse(linkinTypeForElement, elements[x], childId);
						}
					}
				}
			}
			
			for(var x = 0; x < linkingElements.length; x++){
				var elements = Utils.makeArray(Data[linkingElements[x]]);
				for(var y = 0; y < elements.length; y++){
					var childId = Utils.getElementId(Utils.makeArray(elements[y].Class)[0]);
					__parse([linkingElements[x]], elements[y], childId);
				}
			}
			
			return LinkingTree;
		},
		
		parentTree : function(){
			if(ParentTree){
				return ParentTree;
			}
			
			ParentTree = {};
			
			// monta a árvore de ligações
			var linkingTree = Query("linkingTree");
			for(var childId in linkingTree){
				ParentTree[childId] = Object.keys(LinkingTree[childId]);
			}
			
			return ParentTree;
		},
		
		objectComplementOfMapping : function(){
			// precisa retornar uma CÓPIA do objeto para que se houver alterações não afete o original
			return JSON.parse(JSON.stringify(ObjectComplementOfMapping));
		}
	};
})();