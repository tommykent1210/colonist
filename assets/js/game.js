$( document ).ready(function() {
	console.log( "ready!" );

	var gameInstance = new Game();

    //  hide all researchables
    $('.research-hidden').hide();

    const swalBad = swal.mixin({
		confirmButtonClass: 'btn btn-danger btn-lrpadding',
		cancelButtonClass: 'btn  btn-lrpadding',
		buttonsStyling: false,
	})

    $('.reset').on('click', function() {
    	swalBad({
			title: 'Are you sure?',
			text: "You won't be able to recover your save game later!",
			type: 'warning',
			showCancelButton: true,
			confirmButtonText: 'Yes, restart!',
			cancelButtonText: 'No, cancel!',
			reverseButtons: false
		}).then((result) => {
		  if (result.value) {
		    gameInstance.resetGame();
		  }
		});
    });

    $('.save').on('click', function() {
    	
		gameInstance.saveGame();
	
    });

    // get any action button
    $('.action').on('click', function() {
    	console.log('clicked');
    	var action = $(this).data('action');
    	var actionvalue = $(this).data('actionvalue');

    	gameInstance.doAction(action, actionvalue);
    });

    $('.purchase').on('click', function() {
    	console.log('purchase');
    	var building = $(this).data('building');
    	var amount = $(this).data('amount');

    	gameInstance.doPurchaseBuilding(building, amount);
    });

    $('.destroy').on('click', function() {
    	var building = $(this).data('building');
    	var amount = $(this).data('amount');
    	console.log("destroy "+building);
    	gameInstance.doDestroyBuilding(building, amount);
    });

    $('.research').on('click', function() {
    	var task = $(this).data('task');
    	if(gameInstance.doResearch(task)) {

    		$(this).prop('disabled', true).addClass('disabled').removeClass('btn-primary').addClass('btn-success');
    	}
    });

    $('.marketplace-quantity').on('click', function() {
    	gameInstance.setMarketplaceQuantity($(this).data('quantity'));
    	$('.marketplace-quantity').addClass('disabled');
    	$(this).removeClass('disabled');
    });

    $('.marketplace-button').on('click', function() {
    	var action = $(this).data('action');
    	var resource = $(this).data('item');
    	console.log("clicked marketplace button"+action+resource);
    	gameInstance.marketplaceBuySell(resource, action);
    })

    $('body').tooltip({
    	selector: '[rel=tooltip]'
    });

    $.get('assets/revision', function(data) {
    	//console.log(data);
    	$('span.revision').text(gameInstance.getVersion() + " - "+data.substring(3,8));
    });

    jQuery.getJSON( "assets/changelogs/changelog.json", function( data ) {
    	console.log(data);
    	var items = [];
    	$.each(data, function(index, item) {
    		//console.log(item)
    		items.push('<h3 class="changelog-version">Version ' + item.version + '</h3>');
    		items.push('<h5 class="changelog-date">' + item.date + '</h5>');

    		if(item.added.length > 0) {
    			var added = '<h4 class="changelog-type">Added:</h4><ul class="changelog-list">';
    			for (var i = item.added.length - 1; i >= 0; i--) {
    				added += '<li>' + item.added[i] + '</li>';
    			};

    			added += '</ul>';
    			items.push(added);
    			//console.log("Found additions!");
    		}

    		if(item.changed.length > 0) {
    			var changed = '<h4 class="changelog-type">Changed:</h4><ul class="changelog-list">';
    			for (var i = item.changed.length - 1; i >= 0; i--) {
    				changed += '<li>' + item.changed[i] + '</li>';
    			};

    			changed += '</ul>';
    			items.push(changed);
    			//console.log("Found changes!");
    		}

    		if(item.fixed.length > 0) {
    			var fixed = '<h4 class="changelog-type">Fixed:</h4><ul class="changelog-list">';
    			for (var i = item.fixed.length - 1; i >= 0; i--) {
    				fixed += '<li>' + item.fixed[i] + '</li>';
    			};

    			fixed += '</ul>';
    			items.push(fixed);
    			//console.log("Found fixes!");
    		}

    		if(item.removed.length > 0) {
    			var removed = '<h4 class="changelog-type">Removed:</h4><ul class="changelog-list">';
    			for (var i = item.removed.length - 1; i >= 0; i--) {
    				removed += '<li>' + item.removed[i] + '</li>';
    			};

    			removed += '</ul>';
    			items.push(removed);
    			//console.log("Found removals!");
    		}

    		if(index != data.length - 1) {
    			items.push('<hr>');
    		}
    		
    	});

		$.each(items, function(index, item) {
			$('.changelog-body').append(item);
		});

		//console.log(items);

	});

});


	


var Game = function() {
	
	var Data = {};
	var Messages = [];
	var maxMessages = 30;
	var Debug = true;
	var GameStarted = false;
	var ticks = 0;
	var MarketplaceBuyQuantity = 1;
	var MarketplaceBuyPercentage = 1.1;
	var MarketplaceSellPercentage = 0.9;

	var version = 'v0.1.4 ';

	var Bonuses, BaseBonuses = {};

	var DeathReasons = ["from old age", 'from dyssentry', 'from the plague', 'after a wild boar attack', 'in a wolf attack', 'in a knitting accident'];
	
	addMessage('[Game] Game Engine Started');

	var Buildings = {
		house: { type: "housing", title: "Small House", description: "Provides housing for 6 colonists", researchRequired: false, research: "", cost: {wood: 20, stone: 25}, capacity: 6, workers: 0, generates: {} },
		woodshack: { type: "production", title: "Wood Shack", description: "Lumberjacks generate wood here", researchRequired: false, research: "", cost: {wood: 5, stone: 15}, capacity: 0, workers: 2, generates: {wood: 2} },
		farm: { type: "production", title: "Farm", description: "Farms provide basic food", researchRequired: false, research: "", cost: {wood: 20, stone: 10}, capacity: 0, workers: 4, generates: {food: 2.5} },
		ironmine: { type: "production", title: "Iron Rich Quarry", description: "Quarries provide ores and stone", researchRequired: false, research: "", cost: {wood: 15, stone: 5}, capacity: 0, workers: 3, generates: {ironore: 0.25, stone: 0.5} },
		charcoalkiln: { type: "refining", title: "Charcoal Kiln", description: "Turns wood to charcoal", researchRequired: true, research: "charcoalsmelting", cost: {wood: 20, stone: 15}, capacity: 0, workers: 2, generates: {wood: -1, charcoal: 0.5} },
		ironforge: { type: "refining", title: "Iron Forge", description: "Refines iron ore into iron ingots", researchRequired: true, research: "ironsmelting", cost: {wood: 10, stone: 35}, capacity: 0, workers: 3, generates: {ironore: -0.5, charcoal: -0.5, iron: 0.25} },
		toolery: { type: "manufacturing", title: "Toolery", description: "Turns iron into tools", researchRequired: true, research: "toolmaking", cost: {wood: 150, stone: 50, iron: 20}, capacity: 0, workers: 3, generates: {iron: -0.5, tools: 0.25} },
		lab: { type: "science", title: "Science Lab", description: "Progress your colony!", researchRequired: true, research: "scientificresearch", cost: {wood: 150, stone: 100, tools: 20}, capacity: 0, workers: 3, generates: {tools: -0.15, science: 0.5} },
		goldmine: { type: "production", title: "Gold Mine", description: "Mine gold ore from gold rich veins", researchRequired: true, research: "goldmining", cost: {wood: 150, stone: 100, tools: 20}, capacity: 0, workers: 4, generates: {tools: -0.1, goldore: 0.2} },
		goldforge: { type: "refining", title: "Gold Forge", description: "Refines gold ore into gold ingots", researchRequired: true, research: "goldsmelting", cost: {wood: 350, stone: 200, tools: 50}, capacity: 0, workers: 3, generates: {tools: -0.15, goldore: -0.2, gold: 0.1} },
		mint: { type: "manufacturing", title: "Mint", description: "Convert gold to coins", researchRequired: true, research: "coinminting", cost: {wood: 350, stone: 200, tools: 50, gold: 20}, capacity: 0, workers: 3, generates: {gold: -0.1, coins: 0.2} },

		// level 2 buildings
		mill: { type: "production", title: "Mill", description: "Process food to increase yield", researchRequired: true, research: "milling", cost: {wood: 650, stone: 500, tools: 50}, capacity: 0, workers: 4, generates: {tools: -0.25, food: 2} },
		ironmine2: { type: "production", title: "Iron Shaft Mine", description: "A rich vein of iron can be mined", researchRequired: true, research: "advancedmining", cost: {wood: 350, stone: 500, tools: 50}, capacity: 0, workers: 4, generates: {tools: -0.25, ironore: 0.8, stone: 0.1} },
		goldmine2: { type: "production", title: "Gold Shaft Mine", description: "A seam of gold glistens in the torchlight", researchRequired: true, research: "advancedmining", cost: {wood: 350, stone: 500, tools: 50}, capacity: 0, workers: 4, generates: {tools: -0.25, ironore: 0.8, stone: 0.1} },
	};


	//var Resources = ["science", "wood", "stone", "food", "ironore", "iron", "tools", "charcoal", "goldore", "gold", "coins"];

	var Resources = {
		"science": {
			title: "Science",
			market: false,
			researchRequired: false,
			research: "",
			baseValue: 0
		}, 
		"wood": {
			title: "Wood",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 10
		}, 
		"stone": {
			title: "Stone",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 10
		},
		"food": {
			title: "Food",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 20
		}, 
		"ironore": {
			title: "Iron Ore",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 50
		},
		"iron": {
			title: "Iron",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 100
		},
		"tools": {
			title: "Tools",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 150
		},
		"charcoal": {
			title: "Charcoal",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 10
		},
		"goldore": {
			title: "Gold Ore",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 150
		},
		"gold": {
			title: "Gold",
			market: true,
			researchRequired: false,
			research: "",
			baseValue: 300
		},
		"coins": {
			title: "Coins",
			market: false,
			researchRequired: false,
			research: "",
			baseValue: 0
		}
	};

	var Research = {
		increasedcapacity: { title: 'Increased Colonist Capacity Level 1 (+10%)',researchRequired: false, research: "", type: "global",  cost: { science: 100, food: 250}, bonuses: { globalbonus: { colonistCapacity: 1.1 }} },
		increasedcapacity2: { title: 'Increased Colonist Capacity Level 2 (+10%)',researchRequired: true, research: "increasedcapacity", type: "global",  cost: { science: 300, food: 500}, bonuses: { globalbonus: { colonistCapacity: 1.1 }} },
		increasedcapacity3: { title: 'Increased Colonist Capacity Level 3 (+10%)',researchRequired: true, research: "increasedcapacity2", type: "global",  cost: { science: 750, food: 1000}, bonuses: { globalbonus: { colonistCapacity: 1.1 }} },
		
		reducedfood: { title: 'Reduced Food Cost Level 1 (-10%)',researchRequired: false, research: "", type: "global",  cost: { science: 100, food: 250}, bonuses: { globalbonus: { foodConsumptionRate: 0.9 }} },
		reducedfood2: { title: 'Reduced Food Cost Level 2 (-10%)',researchRequired: true, research: "reducedfood", type: "global",  cost: { science: 300, food: 500}, bonuses: { globalbonus: { foodConsumptionRate: 0.9 }} },
		reducedfood3: { title: 'Reduced Food Cost Level 3 (-10%)',researchRequired: true, research: "reducedfood2", type: "global",  cost: { science: 750, food: 1000}, bonuses: { globalbonus: { foodConsumptionRate: 0.9 }} },
		
		foodproduction1: { title: 'Food Production Level 1 (+10%)',researchRequired: false, research: "", type: "production",  cost: { science: 100, food: 500}, bonuses: { production: { food: 1.10 }} },
		foodproduction2: { title: 'Food Production Level 2 (+15%)',researchRequired: true, research: "foodproduction1", type: "production",  cost: { science: 200, food: 1000}, bonuses: { production: { food: 1.15 }} },
		foodproduction3: { title: 'Food Production Level 3 (+20%)',researchRequired: true, research: "foodproduction2", type: "production",  cost: { science: 2000, food: 10000}, bonuses: { production: { food: 1.20 }} },
		
		woodcutting1: { title: 'Woodcutting Level 1 (+10%)',researchRequired: false, research: "", type: "production",  cost: { science: 100, wood: 500}, bonuses: { production: { wood: 1.10 }} },
		woodcutting2: { title: 'Woodcutting Level 2 (+15%)',researchRequired: true, research: "woodcutting1", type: "production",  cost: { science: 200, wood: 1000}, bonuses: { production: { wood: 1.15 }} },
		woodcutting3: { title: 'Woodcutting Level 3 (+20%)',researchRequired: true, research: "woodcutting2", type: "production",  cost: { science: 2000, wood: 10000}, bonuses: { production: { wood: 1.20 }} },
		
		stonecutting1: { title: 'Stonecutting Level 1 (+10%)', researchRequired: false, research: "", type: "production", cost: { science: 100, stone: 500}, bonuses: { production: { stone: 1.10 }} },
		stonecutting2: { title: 'Stonecutting Level 2 (+15%)',researchRequired: true, research: "stonecutting1", type: "production",  cost: { science: 200, stone: 1000}, bonuses: { production: { stone: 1.15 }} },
		stonecutting3: { title: 'Stonecutting Level 3 (+20%)',researchRequired: true, research: "stonecutting2", type: "production",  cost: { science: 2000, stone: 10000}, bonuses: { production: { stone: 1.20 }} },
		
		ironmining1: { title: 'Iron Mining Level 1 (+10%)', researchRequired: false, research: "", type: "production", cost: { science: 100, ironore: 500}, bonuses: { production: { ironore: 1.10 }} },
		ironmining2: { title: 'Iron Mining Level 2 (+15%)',researchRequired: true, research: "ironmining1", type: "production",  cost: { science: 200, ironore: 1000}, bonuses: { production: { ironore: 1.15 }} },
		ironmining3: { title: 'Iron Mining Level 3 (+20%)',researchRequired: true, research: "ironmining2", type: "production",  cost: { science: 2000, ironore: 10000}, bonuses: { production: { ironore: 1.20 }} },
		
		ironrefining1: { title: 'Iron Refining Level 1 (+10%)',researchRequired: true, research: "ironsmelting", type: "production",  cost: { science: 100, iron: 500}, bonuses: { production: { iron: 1.10 }} },
		ironrefining2: { title: 'Iron Refining Level 2 (+15%)',researchRequired: true, research: "ironrefining1", type: "production",  cost: { science: 200, iron: 1000}, bonuses: { production: { iron: 1.15 }} },
		ironrefining3: { title: 'Iron Refining Level 3 (+20%)',researchRequired: true, research: "ironrefining2", type: "production",  cost: { science: 2000, iron: 10000}, bonuses: { production: { iron: 1.20 }} },
		
		goldmining1: { title: 'Gold Mining Level 1 (+10%)',researchRequired: true, research: "goldmining", type: "production",  cost: { science: 100, goldore: 500}, bonuses: { production: { goldore: 1.10 }} },
		goldmining2: { title: 'Gold Mining Level 2 (+15%)',researchRequired: true, research: "goldmining1", type: "production",  cost: { science: 200, goldore: 1000}, bonuses: { production: { goldore: 1.15 }} },
		goldmining3: { title: 'Gold Mining Level 3 (+20%)',researchRequired: true, research: "goldmining2", type: "production",  cost: { science: 2000, goldore: 10000}, bonuses: { production: { goldore: 1.20 }} },
		
		goldrefining1: { title: 'Gold Refining Level 1 (+10%)',researchRequired: true, research: "goldsmelting", type: "production",  cost: { science: 100, gold: 500}, bonuses: { production: { gold: 1.10 }} },
		goldrefining2: { title: 'Gold Refining Level 2 (+15%)',researchRequired: true, research: "goldrefining1", type: "production",  cost: { science: 200, gold: 1000}, bonuses: { production: { gold: 1.15 }} },
		goldrefining3: { title: 'Gold Refining Level 3 (+20%)',researchRequired: true, research: "goldrefining2", type: "production",  cost: { science: 2000, gold: 10000}, bonuses: { production: { gold: 1.20 }} },
		
		charcoal1: { title: 'Charcoal Kiln Level 1 (+10%)',researchRequired: true, research: "charcoalsmelting", type: "production",  cost: { science: 100, charcoal: 500}, bonuses: { production: { charcoal: 1.10 }} },
		charcoal2: { title: 'Charcoal Kiln Level 2 (+15%)',researchRequired: true, research: "charcoal1", type: "production",  cost: { science: 200, charcoal: 1000}, bonuses: { production: { charcoal: 1.15 }} },
		charcoal3: { title: 'Charcoal Kiln Level 3 (+20%)',researchRequired: true, research: "charcoal2", type: "production",  cost: { science: 2000, charcoal: 10000}, bonuses: { production: { charcoal: 1.20 }} },
		
		tooling1: { title: 'Toolery Level 1 (+10%)',researchRequired: true, research: "toolmaking", type: "production",  cost: { science: 100, tools: 500}, bonuses: { production: { tools: 1.10 }} },
		tooling2: { title: 'Toolery Level 2 (+15%)',researchRequired: true, research: "tooling1", type: "production",  cost: { science: 200, tools: 1000}, bonuses: { production: { tools: 1.15 }} },
		tooling3: { title: 'Toolery Level 3 (+20%)',researchRequired: true, research: "tooling2", type: "production",  cost: { science: 2000, tools: 10000}, bonuses: { production: { tools: 1.20 }} },
		
		researching1: { title: 'Research Level 1 (+10%)',researchRequired: true, research: "scientificresearch", type: "production",  cost: { science: 100, wood: 500, stone: 500, tools: 500}, bonuses: { production: { science: 1.10 }} },
		researching2: { title: 'Research Level 2 (+15%)',researchRequired: true, research: "researching1", type: "production",  cost: { science: 200, wood: 1000, stone: 1000, tools: 1000}, bonuses: { production: { science: 1.15 }} },
		researching3: { title: 'Research Level 3 (+20%)',researchRequired: true, research: "researching2", type: "production",  cost: { science: 2000, wood: 10000, stone: 10000, tools: 10000}, bonuses: { production: { science: 1.20 }} },
		
		charcoalsmelting: { title: 'Unlock Charcoal Kiln',researchRequired: false, research: "", type: "unlock",  cost: { wood: 100, stone: 100}, bonuses: {} },
		ironsmelting: { title: 'Unlock Iron Forging', researchRequired: true, research: "charcoalsmelting", type: "unlock", cost: { ironore: 50, stone: 100, charcoal: 50}, bonuses: {} },
		toolmaking: { title: 'Unlock Tool Making', researchRequired: true, research: "ironsmelting", type: "unlock", cost: { iron: 50, charcoal: 100}, bonuses: {} },
		scientificresearch: { title: 'Unlock Scientific Research', researchRequired: true, research: "toolmaking", type: "unlock", cost: { iron: 50, charcoal: 100}, bonuses: {} },
		goldmining: { title: 'Unlock Gold Mining', researchRequired: true, research: "toolmaking", type: "unlock", cost: { iron: 50, charcoal: 100, tools: 100}, bonuses: {} },
		goldsmelting: { title: 'Unlock Gold Forging', researchRequired: true, research: "goldmining", type: "unlock", cost: { charcoal: 100, goldore: 100, tools: 100}, bonuses: {} },
		coinminting: { title: 'Unlock Coin Minting', researchRequired: true, research: "goldsmelting", type: "unlock", cost: { gold: 100, tools: 100}, bonuses: {} },
		marketplace: { title: 'Unlock Marketplace', researchRequired: true, research: "coinminting", type: "unlock", cost: { coins: 1000, stone: 500}, bonuses: {} },
		milling: { title: 'Unlock Mill', researchRequired: true, research: "buildinglevel2", type: "unlock", cost: { iron: 500, food: 1000, wood: 1000, coins: 500}, bonuses: {} },
		advancedmining: { title: 'Unlock Advanced Mines', researchRequired: true, research: "buildinglevel2", type: "unlock", cost: { iron: 500, gold: 500, wood: 1000, coins: 500}, bonuses: {} },
		


		buildinglevel2: { title: 'Unlock Level 2 Buildings', researchRequired: false, research: "", type: "unlock", cost: { iron: 1000, gold: 1000, tools: 1000, coins: 1000}, bonuses: {} },
		
	};

	var ResourcesUnlocked = {};

	start();

	// Runs at page start
	function start() {
		updateMessages();
		beginGame();
	}

	function beginGame() {
		console.log('begin');
		//console.log(Data);


		// check if a previous save game exists
		if(checkForPreviousGame()) {

			initialise(false);
			// try to load a save
			loadGame();
		} else {

			initialise(true);
		}

		//console.log(Data);
		updateBuildingCosts();
		$('[data-toggle="tooltip"], .is_tooltip').tooltip();

		GameStarted = true;

		setInterval(update, 1000);
		setInterval(redraw, 100);
		
	}

	function initialise(newgame) {
		BaseBonuses = {
			globalbonus: {
				productivity: 1,
				colonistCapacity: 1,
				foodConsumptionRate: 1,
				requiredColonists: 1,
				fertilityRate: 1,
				deathRate: 1,
				immigrationRate: 1
			},
			production: {

			}
		};

		Bonuses = BaseBonuses;

		if(Object.keys(Data).length === 0 && Data.constructor === Object) {
			//Object is empty!
			Data = {
				version: version,
				buildings: {},
				resources: {},
				production: {},
				research: {},
				colonists: 10,
				productivity: 1.0,
				colonistCapacity: 10,
				foodConsumptionRate: 0.2,
				requiredColonists: 0,
				fertilityRate: 0.1,
				deathRate: 0.001,
				immigrationRate: 0.20,
				lastSave: Date.now(),
			}

			for (var i = Object.keys(Resources).length - 1; i >= 0; i--) {
				Data.resources[Object.keys(Resources)[i]] = 0;
				Data.production[Object.keys(Resources)[i]] = 0;
				BaseBonuses.production[Object.keys(Resources)[i]] = 1;
				ResourcesUnlocked[Object.keys(Resources)[i]] = 0;
			};


			for (var i = Object.keys(Buildings).length - 1; i >= 0; i--) {
				Data.buildings[Object.keys(Buildings)[i]] = 0;
			};

			for (var i = Object.keys(Research).length - 1; i >= 0; i--) {
				Data.research[Object.keys(Research)[i]] = 0;
			};

			addBuilding('house', 3);
			addBuilding('farm', 2);

			addResource('wood', 50);
			addResource('stone', 50);
			addResource('food', 100);



			//Data.research["marketplace"] = 1;
			
		}



		recalculateBonuses();
		generateMarketplaceList();
		generateBuildings();
		generateResearchList();


		generateResourceList();
		$('.resourceListRow').hide();

		if(newgame == true) {
			unlockBaseResources(false);
			addMessage('[Game] New game started');
		}
	}

	function unlockBaseResources(notify) {

			unlockResource('food', notify);
			unlockResource('wood', notify);
			unlockResource('stone', notify);


	}

	function doAction(action, actionvalue) {
		console.log('do '+ action + ' with ' + actionvalue);

		Data.test += 1;
		console.log(Data.test);
	}

	function doPurchaseBuilding(building, amount) {
		
		var purchaseCost = Buildings[building].cost;
		var currentNumber = Data.buildings[building];
		var ableToPurchase = true;
		
		for (var i = Object.keys(purchaseCost).length - 1; i >= 0; i--) {
			var tempResourceName = Object.keys(purchaseCost)[i];
			if(Data.resources[tempResourceName] < purchaseCost[tempResourceName] * (currentNumber + 1) * amount) {
				ableToPurchase = false;
			}
		};

		if(ableToPurchase == true) {
			for (var i = Object.keys(purchaseCost).length - 1; i >= 0; i--) {
				var tempResourceName = Object.keys(purchaseCost)[i];
				Data.resources[tempResourceName] -= (purchaseCost[tempResourceName] * (currentNumber + 1) * amount) 
			};
			Data.buildings[building] += amount;
			addMessage('[Building] Success! Purchased ' + Buildings[building].title + '!');
		} else {
			// tell the user no
			addMessage('[Building] Fail! Not enough resources!');
		}

		// if its a house, update capacity!
		if(Buildings[building].type == "house") {
			updateCapacity();
		}

		// Update production stats
		updateProduction();
		updateResourceLabels();
		updateBuildingLabels();
		updateBuildingCosts();
		togglePurchaseButtons();
		console.log(Data);
	}

	function doDestroyBuilding(building, amount) {
		if(Data.buildings[building] >= amount) {
			Data.buildings[building] -= amount;
			addMessage('[Building] Success! Destroyed ' + building + '!');
		} 

		togglePurchaseButtons();
		updateBuildingLabels();
	}

	function addBuilding(building, amount) {
		Data.buildings[building] += amount;
		// if its a house, update capacity!
		if(Buildings[building].type == "housing") {
			updateCapacity();
		}

		// Update production stats
		updateProduction();
		updateResourceLabels();
		updateBuildingCosts();
	}

	function addResource(resource, amount) {
		Data.resources[resource] += amount;
		updateProduction();
		updateResourceLabels();
	}

	function updateCapacity() {
		Data.colonistCapacity = 0;
		for (var i = Object.keys(Data.buildings).length - 1; i >= 0; i--) {
			// For this building, get the name
			var buildingName = Object.keys(Data.buildings)[i];
			var count =	Data.buildings[buildingName];

			if(Buildings[buildingName].type == "housing") {
				Data.colonistCapacity += Buildings[buildingName].capacity * count;
			}
		};



		$('.data.colonists').text(Data.colonists+'/'+( Math.floor(Data.colonistCapacity * Bonuses.globalbonus.colonistCapacity).toFixed(0)));
	}

	function updateProductivity() {
		var reqCol = 0;
		for (var i = Object.keys(Data.buildings).length - 1; i >= 0; i--) {
			// For this building, get the name
			var buildingName = Object.keys(Data.buildings)[i];
			var count =	Data.buildings[buildingName];
			reqCol += Buildings[buildingName].workers * count;
		};


		Data.requiredColonists = reqCol;

		if(reqCol == 0) {
			reqCol = 1;
		}

		var prod = Data.colonists / reqCol;
		
		if(prod > 1) {
			prod = 1;
		} 

		if(prod < 0) {
			prod = 0.1;
		}

		if(Data.resources['food'] == 0) {
			prod *= 0.5;
		}
		
		Data.productivity = prod * Bonuses.globalbonus.productivity;
	}

	function updateProduction() {
		// reset to 0
		for (var i = Object.keys(Data.production).length - 1; i >= 0; i--) {
			Data.production[Object.keys(Data.production)[i]] = 0;
		};

		// iterate over buildings, add up production
		for (var i = Object.keys(Data.buildings).length - 1; i >= 0; i--) {
			// For this building, get the name
			var buildingName = Object.keys(Data.buildings)[i];
			var count =	Data.buildings[buildingName];
			var skipBuilding = false;
			for (var j = Object.keys(Buildings[buildingName].generates).length - 1; j >= 0; j--) {
				if(skipBuilding == true) {
					break;
				}
				var resource = Object.keys(Buildings[buildingName].generates)[j];
				if(resource == 'food') {
					Data.production[resource] += Buildings[buildingName].generates[resource] * count  * Bonuses.production[resource];

				} else {
					
					// try to stop production if the colony can't support it!
					/*if(Buildings[buildingName].generates[resource] < 0 && count > 0 && Data.resources[resource] + Data.production[resource] <= 0) {
						Data.production[resource] = 0;
						addMessage('[Production] Not producing enough '+resource+' to sustain '+buildingName);
						skipBuilding = true;
						break;
					} else {*/
						Data.production[resource] += Buildings[buildingName].generates[resource] * count * Data.productivity * Bonuses.production[resource];

					//}
				}

				
				
				
			};
		};

		// update food!
		Data.production['food'] -= Data.colonists * Data.foodConsumptionRate * Bonuses.globalbonus.foodConsumptionRate;

	}

	function doProduction() {
		if(Object.keys(Data.production).length > 0) {
			for (var i = Object.keys(Data.production).length - 1; i >= 0; i--) {
				var resource = Object.keys(Data.production)[i];
				

				// check if we're on the last bit of food before starvation! Also, food usage is not impacted by productivity!
				if(resource == 'food') {
					if(Data.resources[resource] > 0) {
						Data.resources[resource] += Data.production[resource];
						if(Data.resources[resource] + Data.production[resource] < 0) {
							addMessage('[Colony] The colony is starving! Productivity reduced by 50%!');
						}
					}
				} else {
					Data.resources[resource] += Data.production[resource];
				}

				if(Data.production[resource] > 0 && ResourcesUnlocked[resource] == 0) {
					unlockResource(resource, true);
				}

				if(Data.resources[resource] < 0 || isNaN(Data.resources[resource])) {
					Data.resources[resource] = 0;
				}
			};

		}
	}

	function generateResourceList() {
		
		for (var i = Object.keys(Resources).length - 1; i >= 0; i--) {
			var resource = Object.keys(Resources)[i];
			var resourceObj = Resources[resource];
			resourceObj["handle"] = resource;

			var tmpl = $.templates("#resource-list");
			var templateData = resourceObj;
			var html = tmpl.render(templateData);
			$('.resourceProduction').append(html);
				
		};


	}

	function unlockResource(resource, notify) {
		ResourcesUnlocked[resource] = 1;
		$('.resourceListRow[data-resource="'+ resource +'"]').show();
		if(notify) {
			addMessage('[Colony] You unlocked a resource: ' + resource);
		}
	}

	function updateResourceLabels() {
		if(Object.keys(Data.resources).length > 0) {
			for (var i = Object.keys(Data.resources).length - 1; i >= 0; i--) {
				var resource = Object.keys(Data.resources)[i];
				var number = numberFormat(Data.resources[resource]);

				$('span.resource.'+resource).text(number);
			};

		}

		if(Object.keys(Data.production).length > 0) {
			for (var i = Object.keys(Data.production).length - 1; i >= 0; i--) {
				var resource = Object.keys(Data.production)[i];
				var number = numberFormat((Data.production[resource]).toFixed(2));
				$('span.production.'+resource).html("&nbsp;" + number+ "/t");
			};

		}


		$('span.data.productivity').text((Data.productivity * 100).toFixed(1));
		$('span.data.requiredWorkers').text((Data.requiredColonists).toFixed(0));
		$('span.data.fertility').text((Data.fertilityRate * 100).toFixed(1));
		$('span.data.colonists').text((Data.colonists).toFixed(0)+'/'+ (Math.floor(Data.colonistCapacity * Bonuses.globalbonus.colonistCapacity).toFixed(0) ));
	}

	function generateBuildings() {

		//generate a list of buildings, separated by function
		var buildingList = {
			housing: [],
			production: [],
			refining: [],
			manufacturing: [],
			science: []
		};

		for (var i = Object.keys(Buildings).length - 1; i >= 0; i--) {

			buildingList[Buildings[Object.keys(Buildings)[i]].type].push(Object.keys(Buildings)[i]);
		};

		

		for (var i = Object.keys(buildingList).length - 1; i >= 0; i--) {
			for (var j = buildingList[Object.keys(buildingList)[i]].length - 1; j >= 0; j--) {
				var building = buildingList[Object.keys(buildingList)[i]][j];
				var buildingObj = Buildings[building];
				buildingObj["handle"] = building;

				var tmpl = $.templates("#purchase-building");
				var templateData = buildingObj;
				var html = tmpl.render(templateData);
				$('.building-purchase-container .category-'+buildingObj.type).append(html);
				
				var tmpl2 = $.templates("#building-quantities");
				var html2 = tmpl2.render(templateData);
				$('.building-list').append(html2);
			};

		};


	}

	function updateBuildingLabels() {
		for (var i = Object.keys(Data.buildings).length - 1; i >= 0; i--) {
			var building = Object.keys(Data.buildings)[i];
			$('.data.building[data-building='+building+']').text('x' + Data.buildings[building]);
		};
	}

	function updateBuildingCosts() {
		if(Object.keys(Buildings).length > 0) {
			for (var i = Object.keys(Buildings).length - 1; i >= 0; i--) {
				var building = Object.keys(Buildings)[i];
				var purchaseCost = Buildings[building].cost;
				var currentNumber = Data.buildings[building];
				var costs = [];
				var costString = [];
				for (var j = Object.keys(purchaseCost).length - 1; j >= 0; j--) {
					var tempResourceName = Object.keys(purchaseCost)[j];
					costs.push('<img class="resource-icon" src="assets/img/resources/'+ tempResourceName + '.png"  data-toggle="tooltip" data-placement="top" title="'+ Resources[tempResourceName].title +'"/> x' + purchaseCost[tempResourceName] * (currentNumber + 1));
				};

				$('span.cost[data-building='+building+']').html("Cost: " +costs.join(', '));
				$('span.workers[data-building='+building+']').html('Workers: <img class="resource-icon" src="assets/img/resources/worker.png"  data-toggle="tooltip" data-placement="top" title="Workers"/> x' + Buildings[building].workers);
			};

		}

		$('[data-toggle="tooltip"]').tooltip();
	}

	function updateBuildingProductionStats() {
		if(Object.keys(Buildings).length > 0) {
			for (var i = Object.keys(Buildings).length - 1; i >= 0; i--) {
				var building = Object.keys(Buildings)[i];
				var production = Buildings[building].generates;
				var currentNumber = Data.buildings[building];
				var prod = [];
				var costString = [];
				for (var j = Object.keys(production).length - 1; j >= 0; j--) {
					var tempResourceName = Object.keys(production)[j];
					prod.push('<img class="resource-icon" src="assets/img/resources/'+ tempResourceName + '.png"  data-toggle="tooltip" data-placement="top" title="'+ Resources[tempResourceName].title +'"/> ' + production[tempResourceName] + '/t');
				};

				if(prod.length > 0) {

					$('span.production-text[data-building='+building+']').html("Prod: " +prod.join(', '));
				} else {
					$('span.production-text[data-building='+building+']').html("&nbsp;");
				}
			};

		}

		$('[data-toggle="tooltip"]').tooltip();
	}

	function togglePurchaseButtons() {
		for (var i = Object.keys(Buildings).length - 1; i >= 0; i--) {
			var building = Object.keys(Buildings)[i];
			var purchaseCost = Buildings[building].cost;
			var currentNumber = Data.buildings[building];

			var affordable = true;
			// loop through costs
			for (var j = Object.keys(purchaseCost).length - 1; j >= 0; j--) {
				var tempResourceName = Object.keys(purchaseCost)[j];
				if(Data.resources[tempResourceName] < purchaseCost[tempResourceName] * (currentNumber + 1)) {
					affordable = false;
				}
				
			};

			if(affordable == false) {
				$('button.purchase[data-building='+building+']').prop('disabled', true).addClass('disabled');
			} else {
				$('button.purchase[data-building='+building+']').prop('disabled', false).removeClass('disabled');
			}

			if(currentNumber == 0) {
				$('button.destroy[data-building='+building+']').prop('disabled', true).addClass('disabled');
			} else {
				$('button.destroy[data-building='+building+']').prop('disabled', false).removeClass('disabled');
			}
		};
	}

	function doBirthImmigration() {
		// calculate available housing!
		var availableHousing = Data.colonistCapacity * Bonuses.globalbonus.colonistCapacity - Data.colonists;
		var availableFood = Data.resources["food"];

		if(availableHousing > 0) {
			// birthing first
			var maxBirths = Data.fertilityRate * Bonuses.globalbonus.fertilityRate * Data.colonists;
			var children = Math.floor(Math.random() * maxBirths);
			if(children > 0 && Data.colonists + children <= Data.colonistCapacity * Bonuses.globalbonus.colonistCapacity && Data.resources["food"] > children) {

				addColonist(children);
				addMessage('[Colony] Colonists gave birth to '+children+' children');
			}
		}

		if(availableHousing > 0) {
			// birthing first
			var maxBirths = Data.immigrationRate * Bonuses.globalbonus.immigrationRate * Data.colonists;
			var migrants = Math.floor(Math.random() * maxBirths);
			if(migrants >0 && Data.colonists + migrants <= Data.colonistCapacity * Bonuses.globalbonus.colonistCapacity && Data.resources["food"] > migrants) {

				addColonist(migrants, true);
				addMessage('[Colony] '+migrants+' migrants came to the colony');				
			}
		}

		updateProduction();
	}

	function doDeath() {
		var deathRand = Math.floor(Math.random() * Data.colonists * Data.deathRate);
		if(deathRand > 0) {
			Data.colonists -= deathRand;
			var deathReason = DeathReasons[Math.floor(Math.random() * DeathReasons.length)];
			addMessage('[Colony] ' + deathRand + ' colonists died ' + deathReason);
		}
	}

	function addColonist(number, ignorefood) {
		if(Data.resources["food"] > number || ignorefood == true) {
			if(ignorefood == false) {
				Data.resources["food"] -= number;
			}
			Data.colonists += number;
		}
	}

	function doResearch(task) {

		// if the research exists!
		if(Research.hasOwnProperty(task)) {
			if(Data.research[task] == 1) {
				// already researched
				return false;
			}
			var affordable = true;
			for (var i = Object.keys(Research[task].cost).length - 1; i >= 0; i--) {
				var resource = Object.keys(Research[task].cost)[i];
				if(Data.resources[resource] < Research[task].cost[resource]) {
					affordable = false;
				}
			};

			if(affordable == true) {
				for (var i = Object.keys(Research[task].cost).length - 1; i >= 0; i--) {
					var resource = Object.keys(Research[task].cost)[i];
					Data.resources[resource] -= Research[task].cost[resource];
				};
				Data.research[task] = 1;
				addMessage('[Research] Research completed: '+Research[task].title);

				recalculateBonuses();
				return true;
			} else {
				addMessage('[Research] Can\'t afford!');
				return false;
			}
		} else {
			addMessage('[Research] Invalid Research Object...');
			return false;
		}

	}

	function updateResearchLabels() {
		for (var i = Object.keys(Research).length - 1; i >= 0; i--) {
			var researchName = Object.keys(Research)[i];
			var researchObj = Research[researchName];

			var buttonText = researchObj.title + ': ';

			for (var j = Object.keys(researchObj.cost).length - 1; j >= 0; j--) {
				var costText = '<img class="resource-icon" src="assets/img/resources/'+Object.keys(researchObj.cost)[j]+'.png" data-toggle="tooltip" data-placement="top" title="'+ Object.keys(researchObj.cost)[j] +'"/> x' + researchObj.cost[Object.keys(researchObj.cost)[j]] + "&nbsp;";
				buttonText += costText;
			};

			var button = $('.btn.research[data-task="'+researchName+'"] > span.research-description');

			button.html(buttonText);
		};
	}

	function toggleResearchButtons() {
		for (var i = Object.keys(Research).length - 1; i >= 0; i--) {
			var researchName = Object.keys(Research)[i];
			var purchaseCost = Research[researchName].cost;

			var affordable = true;
			// loop through costs
			for (var j = Object.keys(purchaseCost).length - 1; j >= 0; j--) {
				var tempResourceName = Object.keys(purchaseCost)[j];
				if(Data.resources[tempResourceName] < purchaseCost[tempResourceName]) {
					affordable = false;
				}
				
			};

			if(affordable == false || Data.research[researchName] == 1) {
				$('.btn.research[data-task="'+researchName+'"]').prop('disabled', true).addClass('disabled');
				if(Data.research[researchName] == 1) {
					$('.btn.research[data-task="'+researchName+'"]').addClass('btn-success');
				}
			} else {
				$('.btn.research[data-task="'+researchName+'"]').prop('disabled', false).removeClass('disabled');

			}

		};
	}

	function updateResearchedBuildingsAndItems() {
		$('.research-hidden').each(function() {
			var researchTask = $(this).data('research');

			if(Data.research[researchTask] != undefined) {
				if(Data.research[researchTask] == 1) {
					$(this).show();
				} else {
					$(this).hide();
				}
			}
		});
	}

	function generateResearchList() {

		//generate a list of buildings, separated by function
		var researchList = {
			unlock: [],
			global: [],
			production: []
		};

		for (var i = Object.keys(Research).length - 1; i >= 0; i--) {
			var resName = Object.keys(Research)[i];
			//console.log(resName);
			//console.log(Research[resName]);
			researchList[Research[resName].type].push(resName);
		};

		

		for (var i = Object.keys(researchList).length - 1; i >= 0; i--) {
			for (var j = researchList[Object.keys(researchList)[i]].length - 1; j >= 0; j--) {
				var research = researchList[Object.keys(researchList)[i]][j];
				var researchObj = Research[research];
				researchObj["handle"] = research;

				var tmpl = $.templates("#research-button");
				var templateData = researchObj;
				var html = tmpl.render(templateData);
				$('.research-button-container .category-'+researchObj.type).append(html);
				//console.log(html);
			};

		};
	}

	function loadResearchFromSave() {
		for (var i = Object.keys(Data.research).length - 1; i >= 0; i--) {
			var researchName = Object.keys(Data.research)[i];
			if(Data.research[researchName] == 1) {
				$('.research[data-task="'+researchName+'"]').prop('disabled', true).addClass('disabled').removeClass('btn-primary').addClass('btn-success');

			}
		};
		
		recalculateBonuses();
	}

	function recalculateBonuses() {
		//reset bonuses
		Bonuses = JSON.parse(JSON.stringify(BaseBonuses));

		var bonusesVisible = false;
		// calculate research bonuses
		if(Object.keys(Data.research).length > 0) {

			for (var i = Object.keys(Data.research).length - 1; i >= 0; i--) {
				var researchName = Object.keys(Data.research)[i];
				if(Data.research[researchName] == 0) {
					// not yet researched
					continue;
				}
				bonusesVisible = true;
				var researchObj = Research[researchName];
				// if the research exists!
				if(Research.hasOwnProperty(researchName)) {
					// the research exists, now loop through global bonuses
					if(researchObj.bonuses.hasOwnProperty("globalbonus")) {
						for (var j = Object.keys(researchObj.bonuses.globalbonus).length - 1; j >= 0; j--) {
							var bonusname = Object.keys(researchObj.bonuses.globalbonus)[j];
							Bonuses.globalbonus[bonusname] *= researchObj.bonuses.globalbonus[bonusname]; 
						};
					}

					if(researchObj.bonuses.hasOwnProperty("production")) {
						for (var j = Object.keys(researchObj.bonuses.production).length - 1; j >= 0; j--) {
							var bonusname = Object.keys(researchObj.bonuses.production)[j];
							Bonuses.production[bonusname] *= researchObj.bonuses.production[bonusname]; 
						};
					}
				}
			};
		}

		if(bonusesVisible == true) {
			$('.bonusesBox').show();
		} else {
			$('.bonusesBox').hide();
		}

		updateBonusLabels();
		console.log(Bonuses);
	}

	function updateBonusLabels() {
		// hide all bonuses
		$('tr.bonusRow').hide();
		if(Bonuses.hasOwnProperty("globalbonus")) {
			for (var i = Object.keys(Bonuses.globalbonus).length - 1; i >= 0; i--) {
				var bonusObj = Object.keys(Bonuses.globalbonus)[i];
				var bonusVal = Bonuses.globalbonus[bonusObj];
				if(bonusVal != 1) {
					$('span.bonus[data-bonus="globalbonus.'+bonusObj+'"]').text((bonusVal * 100).toFixed(0)+"%");
					$('tr.bonusRow[data-bonus="globalbonus.'+bonusObj+'"]').show();
				}
			};
		}

		if(Bonuses.hasOwnProperty("production")) {
			for (var i = Object.keys(Bonuses.production).length - 1; i >= 0; i--) {
				var bonusObj = Object.keys(Bonuses.production)[i];
				var bonusVal = Bonuses.production[bonusObj];
				if(bonusVal != 1) {
					$('span.bonus[data-bonus="production.'+bonusObj+'"]').text((bonusVal * 100).toFixed(0)+"%");
					$('tr.bonusRow[data-bonus="production.'+bonusObj+'"]').show();
				}
			};
		}
	}


	// marketplace
	
	// generate all the marketplace buttons
	function generateMarketplaceList() {
		for (var i = Object.keys(Resources).length - 1; i >= 0; i--) {
			var res = Object.keys(Resources)[i];

			if(Resources[res].market == true) {
				var tmpl = $.templates("#marketplace-template");
				var templateData = {resourceTitle: Resources[res].title, resourceHandle: res};
				var html = tmpl.render(templateData);
				$('.marketplace-body').append(html);
			}
		};
	}

	function setMarketplaceQuantity(value) {
		MarketplaceBuyQuantity = value;
		console.log(value);
	}

	function marketplaceBuySell(res, action) {
		console.log(action);
		console.log(res);
		if(Resources[res].market == true) {
			if(action == "buy") {
				// we are buying
				var buyCost = MarketplaceBuyQuantity * Resources[res].baseValue * MarketplaceBuyPercentage;
				if(buyCost <= Data.resources["coins"]) {
					Data.resources["coins"] -= buyCost;
					Data.resources[res] += MarketplaceBuyQuantity;

					addMessage('[Marketplace] Bought '+ MarketplaceBuyQuantity +' '+res);
				}
			} else if (action == "sell") {
				//we are selling
				var sellValue = MarketplaceBuyQuantity * Resources[res].baseValue * MarketplaceSellPercentage;
				if(Data.resources[res] >= MarketplaceBuyQuantity) {
					Data.resources["coins"] += sellValue;
					Data.resources[res] -= MarketplaceBuyQuantity;
					addMessage('[Marketplace] Sold '+ MarketplaceBuyQuantity +' '+res);
				}

				unlockResource("coins");
			
			}
		}
	}

	function updateMarketplaceQuantitiesAndAvailability() {
		for (var i = Object.keys(Resources).length - 1; i >= 0; i--) {
			var res = Object.keys(Resources)[i];
			if(ResourcesUnlocked[res] == 1) {
				$('.marketplace-row.resource-'+res).show();
			} else {

				$('.marketplace-row.resource-'+res).hide();
			}

			if(Resources[res].market == true) {
				// update amounts
				$('.marketplace-buy-cost[data-item="'+res+'"]').text(numberFormat(MarketplaceBuyQuantity * Resources[res].baseValue * MarketplaceBuyPercentage, 1)+" coins");
				$('.marketplace-sell-cost[data-item="'+res+'"]').text(numberFormat(MarketplaceBuyQuantity * Resources[res].baseValue * MarketplaceSellPercentage, 1)+" coins");


				if(Data.resources[res] >= MarketplaceBuyQuantity) {
					$('.marketplace-button.sell[data-item="'+res+'"]').removeClass('disabled').prop('disabled', false);
				} else {
					$('.marketplace-button.sell[data-item="'+res+'"]').addClass('disabled').prop('disabled', true);
				}

				if(Data.resources["coins"] >= Resources[res].baseValue * MarketplaceBuyPercentage * MarketplaceBuyQuantity) {
					$('.marketplace-button.buy[data-item="'+res+'"]').removeClass('disabled').prop('disabled', false);
				} else {
					$('.marketplace-button.buy[data-item="'+res+'"]').addClass('disabled').prop('disabled', true);
				}
			}
		};
	}


	function addMessage(message) {
		Messages.push(message);
		if(Messages.length > maxMessages) {
			while(Messages.length > maxMessages) {
				Messages.shift();				
			}
		}

		if(Debug == true) {
			console.log(message);
		}
	}

	function updateMessages() {
		if(Messages.length > 0) {
			$('.messages').empty();
			for (var i = Messages.length - 1; i >= 0; i--) {
				$('.messages').append('<li>'+Messages[i]+'</li>');
			};
		}
	}

	function update() {

		if(GameStarted == true){ 
			console.log('update');

			ticks += 1;

			updateProduction();
			doProduction();
			doDeath();
			doBirthImmigration();
			updateCapacity();

			if(ticks % 120 == 0) {
				saveGame();
			}

			updateProductivity();

			// do this last!
			redraw();
		}
	}

	function redraw() {
		if(GameStarted == true){ 
			updateMessages();
			updateResourceLabels();
			togglePurchaseButtons();
			updateBuildingProductionStats();
			updateBuildingLabels();
			updateResearchLabels();
			toggleResearchButtons();
			updateResearchedBuildingsAndItems();
			updateMarketplaceQuantitiesAndAvailability();
		}
		
	}

	function saveGame() {
		Cookies.set('savegame', Data);
		addMessage('[Game] Saved the game');
		//console.log(Cookies.get());
	}

	function loadGame() {
		if(checkForPreviousGame()) {
			var savegame = JSON.parse(Cookies.get('savegame'));
			console.log("Savegame file");
			console.log(savegame);
			if( savegame.version == version) {
				// begin loading the game
				Data = JSON.parse(JSON.stringify(savegame));

				for (var i = Object.keys(Data.resources).length - 1; i >= 0; i--) {
					if(Data.resources[Object.keys(Data.resources)[i]] > 0) {
						unlockResource(Object.keys(Data.resources)[i]);
					}
				};

				loadResearchFromSave();

				return true;
			} else {
				addMessage("[Game] Found a previous save from another version, unable to load");
				//reinitialise the game!
				unlockBaseResources();
				return false;
			}
		}
		return false;
	}

	function checkForPreviousGame() {
		if(Cookies.get('savegame') != undefined) {
			
			return true;
		} else {
			return false;
		}
	}

	function getVersion() {
		return version;
	}

	function resetGame() {
		console.log('reset!');

		Cookies.remove('savegame');
		location.reload();
	}

	function numberFormat (labelValue) {
		//return labelValue;
		var prefix = '';
		if(labelValue < 0) {
			prefix = "-";
		}
	    /*// Nine Zeroes for Billions
	    var result = Math.abs(Number(labelValue)) >= 1.0e+9

	    ? Math.abs(Number(labelValue)) / 1000000000 + "B"
	    // Six Zeroes for Millions 
	    : Math.abs(Number(labelValue)) >= 1000000

	    ? Math.abs(Number(labelValue)) / 1000000 + "M"
	    // Three Zeroes for Thousands
	    : Math.abs(Number(labelValue)) >= 1000

	    ? Math.abs(Number(labelValue)) / 1000 + "K"

	    : Math.abs(Number(labelValue));

	    return multip * result;*/

	    return nFormatter(labelValue, 2);
	}

	function nFormatter(num, digits) {
		var si = [
		{ value: 1, symbol: "" },
		{ value: 1E3, symbol: "K" },
		{ value: 1E6, symbol: "M" },
		{ value: 1E9, symbol: "B" },
		{ value: 1E12, symbol: "T" },
		{ value: 1E15, symbol: "Q" },
		{ value: 1E18, symbol: "Qi" }
		];
		var rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
		var i;
		for (i = si.length - 1; i > 0; i--) {
			if (num >= si[i].value) {
				break;
			}
		}
		return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
	}

	return {
		beginGame: beginGame,
		doAction: doAction,
		doPurchaseBuilding: doPurchaseBuilding,
		doDestroyBuilding: doDestroyBuilding,
		doResearch: doResearch,
		update: update,
		saveGame: saveGame,
		resetGame: resetGame,
		getVersion: getVersion,
		setMarketplaceQuantity: setMarketplaceQuantity,
		marketplaceBuySell: marketplaceBuySell
	}

}
