import './xml2json.js';
import './Utils.js';
import './Query.js';

(function(){
	window.MAX_OBJECTS_PER_ROW = 5;
	
	var x2js = new X2JS({attributePrefix :"@"});
	
	var Config = require("./config.terms.json");
	var IgnoreList = null;
	var RemoveList = null;
	
	var fn = {
		convert : function(ontology){
			Utils.reset();
			Query.reset();
			Query.setData(ontology);
			
			var convertedData = fn.getDefaultProperties();
			
			convertedData.network.name = Query("owlName");
			convertedData.nodes = Query("nodes");
			
			Utils.setConvertedData(convertedData);
			convertedData = Utils.applyDisjoints();
			
			// somente adiciona o cpt após remover os elements "desnecessários" para não gerar cpt a mais
			for(var x = 0; x < convertedData.nodes.length; x++){
				convertedData.nodes[x].cpt = Utils.generateCpt(convertedData.nodes[x].parents);
			}
			
			convertedData.positions = Query("positions", convertedData.nodes);
			convertedData.network.height = Math.ceil(convertedData.nodes.length / MAX_OBJECTS_PER_ROW) * 145;
			
			// TODO: remover (apenas teste)
			// convertedData.network.width = 1300;
			// convertedData.network.height = 735;
			
			// reconfigura os dados com as alterações no Utils para poder ser utilizado no getNodeById
			Utils.setConvertedData(convertedData);
			
			return fn.validateConvertedData(convertedData) ? convertedData : null;
		},
		
		getDefaultProperties : function(){
			return {
				version : 2,
				network : {
					width : 1200, // a largura é sempre 1200 para caber as 5 colunas
					height : 100, // a altura vai ser calculada de acordo com a quantidade de linhas
					selectedNodes : [],
					beliefs : {},
					propertiesPanelVisible : true
				},
				nodes : [],
				positions : []
			};
		},
		
		validateConvertedData : function(data){
			try{
				if(!data.nodes.length){
					throw "Erro: nenhum objeto foi encontrado no arquivo.";
				}
				
				if(Utils.hasCircularLink()){
					throw [
						"Erro: existem uma ou mais ligações circulares na rede. O editor não permite."
					].join("");
				}
				
				return true;
			}catch(ex){
				Utils.debug(ex);
				alert(ex);
			}
			return false;
		},
		
		ajax : function(url, callback){
			var xmlhttp = new XMLHttpRequest();
			xmlhttp.onreadystatechange = function(){
				if (xmlhttp.readyState == 4 && xmlhttp.status == 200){
					callback(xmlhttp.responseText);
				}
			}
			xmlhttp.open("GET", url, true);
			xmlhttp.send();
		}
	};
	
	window.OWLConversor = {
		convertFromString : function(content){
			try{
				var json = x2js.xml_str2json(content);
				if(json && json.Ontology){
					return fn.convert(json.Ontology);
				}else{
					throw "O conteúdo do arquivo não é uma ontologia!";
				}
			}catch(ex){
				console.error("Error", ex);
				alert(ex);
			}
			return null;
		},
		
		getIgnoreList : function(){
			if(IgnoreList){
				return IgnoreList;
			}
			
			if(!Config.ignoreElements || !Config.ignoreElements.length){
				return {};
			}
			
			var ignoreObjTemp = {};
			for(var x = 0; x < Config.ignoreElements.length; x++){
				var name = Utils.removeAccents(Config.ignoreElements[x].toLowerCase());
				ignoreObjTemp[name] = true;
			}
			
			return IgnoreList = Object.keys(ignoreObjTemp);
		},
		
		getRemoveList : function(){
			if(RemoveList){
				return RemoveList;
			}
			
			if(!Config.removeElements || !Config.removeElements.length){
				return {};
			}
			
			var removeObjTemp = {};
			for(var x = 0; x < Config.removeElements.length; x++){
				var name = Utils.removeAccents(Config.removeElements[x].toLowerCase());
				removeObjTemp[name] = true;
			}
			
			return RemoveList = Object.keys(removeObjTemp);
		}
	};
})();