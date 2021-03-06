import Observable from "./utils/Observable";
import style from "./Diagram.css";
import * as d3 from "d3";
import * as ELK from "ELK";

/**
 * @class
 * Main Diagram class
 * @param {Object} options
 */
export default class Diagram {
	constructor(options) {
		/**
		 * @private
		 * observable handler
		 */
		this._observable = new Observable([
			/**
			 * @event 
			 * Fires when node is clicked
			 * @param {String} node name
			 */
			"nodeClick",
			/**
			 * @event 
			 * Fires when node is highlighted
			 * @param {String} node name
			 * @param {Boolean} highlighted
			 */
			"nodeHighlight"
		]);

		this._options = options || {};

		if (!options.elkWorkerUrl){
			throw "ELK worker URL has to be specified";
		}

		this._elk = new ELK({
			workerUrl: options.elkWorkerUrl
		});		

		/**
		 * @private 
		 * DOM container for diagram
		 */
		this._container = null;

		this._groupColors = options.groupColors || {};
	}

	/**
	 * Bind widget event
	 * @param {String} event event name
	 * @param {Function} handler event handler
	 * @returns {Bar} returns this widget instance
	 */
	on(eventName, handler) {
		this._observable.on(eventName, handler);
		return this;
	}

	/**
	 * Unbind widget event
	 * @param {String} event event name
	 * @param {Function} [handler] event handler
	 * @returns {Bar} returns this widget instance
	 */
	off(eventName, handler) {
		this._observable.off(eventName, handler);
		return this;
	}

	/**
	 * Destroys widget
	 * @returns {Bar} returns this widget instance
	 */
	destroy() {
		this._observable.destroy();
		this._el.remove();
		this._group.remove();
		return this;
	}

	/**
	 * Render logic of this widget
	 * @param {String|DOMElement} selector selector or DOM element 
	 * @returns {Bar} returns this widget instance
	 */
	render(selector) {
		this._container = d3.select(selector);

		this._svg = this._container
			.append("svg")
			.style("position", "absolute")
			.attr("pointer-events", "none");

		this._group = this._svg.append("g");

		// define an arrow head
		this._group.append("svg:defs")
			.append("svg:marker")
			.attr("id", "end")
			.attr("viewBox", "0 -5 10 10")
			.attr("refX", 10)
			.attr("refY", 0)
			.attr("markerWidth", 4)        // marker settings
			.attr("markerHeight", 4)
			.attr("orient", "auto")
			.style("fill", "#546E7A")
			.style("stroke-opacity", 0.6)  // arrowhead color
			.append("svg:path")
			.attr("d", "M0,-5L10,0L0,5");

		this._el = this._container.append("div").classed(style.diagram, true);
	}

	_getRootProperties(){
		return { 
			'algorithm': 'layered',
			'direction':'RIGHT'
		}
	}

	_getElkGraph() {
		return {
			"id": "root",
			properties: this._getRootProperties(),
			"children": this._nodes.map(node => { 
				return {
					id: node.name,
					width: 200,
					height: 50
				}
			}),
			"edges": this._edges.map((edge, index) => {
				return {
					id: "edge_" + index,
					sources: [edge.start],
					targets: [edge.end]
				}
			})
		}
	}

	_setGraphSize(nodes) {
		var maxHeight = Math.max.apply(Math, nodes.map(node => node.y + node.height));
		var maxWidth = Math.max.apply(Math, nodes.map(node => node.x + node.width));

		this._el.style("width", maxWidth + "px");
		this._el.style("height", maxHeight + "px");

		this._svg.attr("width", maxWidth);
		this._svg.attr("height", maxHeight);
	}

	/**
	 * Renders nodes
	 */
	_renderNodes() {
		const graph = this._getElkGraph();

		return this._elk.layout(graph).then(layout => {
			this._nodes.forEach((node, i) => {
				var styles = {
					top: layout.children[i].y,
					left: layout.children[i].x,
					width: layout.children[i].width,
					height: layout.children[i].height
				};

				this._renderNode(node, styles);
			});

			this._renderEdges(layout);
			this._setGraphSize(layout.children);
		});
	}


/**
 * @public
 * Selects node 
 * @param nodeName
 * @param selected
 */
selectNode(nodeName, selected){
	var el = document.getElementById(nodeName);
	if (!el) throw "Node " + nodeName + " doesn't exist or graph hasn't been rendered yet";

	var nodeEl = d3.select(el);

	var selectedClass = style["node-selected"];

	if (selected) {
		d3.select("." + selectedClass).classed(selectedClass, false);
		nodeEl.classed(selectedClass, true);

		this._selectedNodeName = nodeName;
	} else {
		d3.select("." + selectedClass).classed(selectedClass, false);
	}
}

/**
 * @public
 * Highlights node 
 * @param nodeName
 * @param highlighted
 */
highlightNode(nodeName, highlighted){
	var nodeEl = d3.select("#" + nodeName);
	var highlightedClass = style["node-highlighted"];

	if (this._dragging && d3.event.relatedTarget && d3.event.relatedTarget.tagName == "path") {
		return;
	}

	if (highlighted) {
		d3.select("." + highlightedClass).classed(highlightedClass, false);
		nodeEl.classed(highlightedClass, true);
		this._observable.fire("nodeHighlight", nodeName, highlighted);
	} else {
		d3.select("." + highlightedClass).classed(highlightedClass, false);
		this._observable.fire("nodeHighlight", nodeName, highlighted);
	}
}

_onMouseDown(nodeName){
	this._dragging = true;
	// save box on mouse down so we can compare on mouseup
	this._mouseDownBB = document.getElementById(nodeName).getBoundingClientRect();
}

_onMouseUp(nodeName){
	var bb = document.getElementById(nodeName).getBoundingClientRect();
	// only call select when bounding box is same
	if (this._mouseDownBB && this._mouseDownBB.top == bb.top && this._mouseDownBB.left == bb.left) {
		this._observable.fire("nodeClick", nodeName);
	}
	this._dragging = false;
}
/**
 * Renders node 
 * @param node
 */
_renderNode(node, styles){
	var color = this._groupColors[node.group] || "#2196F3";
	var styleStr = Object.keys(styles).map(style => style + ":" + styles[style] + "px").join(";") + "; background-color:" + color;
	var nodeEl = this._el
		.append("div")
		.attr("style", styleStr)
		.attr("class", style.node)
		.attr("id", node.name)
		.on("mousedown", () => {
			this._onMouseDown(node.name);
		})
		.on("mouseup", () => {
			this._onMouseUp(node.name);
		})
		.on("mouseover", () => {
			this.highlightNode(node.name, true);
		}).on("mouseout", () => {
			this.highlightNode(node.name, false);
		});

	var textEl = nodeEl
		.append("div")
		.attr("class", style["node-text"])

	textEl
		.append("i")
		.attr("class", "zmdi "+node.icon || "")
		.classed(style["icon"],true )

	textEl.append("span").html(node.name)
}

_getEdgeOverlay(edge){
	return {
		"arrow": [["PlainArrow", { location: 1, width: 10, length: 10 }]],
		"link": [],
	}[edge.type]
}

/**
 * Renders edges
 */
_renderEdges(layout){
	this._edges.forEach((edge, i) => {
		var link = this._group.append("path")
			.attr("class", "link")
			.attr("stroke", "#546E7A")
			.attr("stroke-width", 2)
			.attr("fill", "transparent")
			.attr("d", () => {
				var d = layout.edges[i].sections[0];
				var path = "";
				if (d.startPoint && d.endPoint) {
					path += "M" + d.startPoint.x + " " + d.startPoint.y + " ";
					(d.bendPoints || []).forEach(function (bp) {
						path += "L" + bp.x + " " + bp.y + " ";
					});
					path += "L" + d.endPoint.x + " " + d.endPoint.y + " ";
				}
				return path;
			})

		if (edge.type == "arrow") {
			link.attr("marker-end", "url(#end)");
		}

	});
}

/**
 * Sets widget data
 * @param {Array} data
 * @returns {Bar} returns this widget instance 
 */
setData(data) {
	if (!this._container) throw "Diagram is not rendered"

	this._el.html("");

	this._nodes = data.nodes || [];
	this._edges = data.edges || [];

	return this._renderNodes();
}
}
