function NavigationTimingRenderer(obj) {
  /** @type {Object} */
  this.object = obj;
  /** @type {Array.<NavigationTimingStruct>} */
  this.struct = this.createStructFromObject(obj);
  /** @type {number} */
  this.min = 0;
  /** @type {number} */
  this.max = 0;
  /** @type {number} */
  this.numTime = 0;
  /** @type {number} */
  this.numRange = 0;
  /** @type {number} */
  this.textPadding = 5;
  /** @type {number} */
  this.labelFontSize = 14;
  /** @type {number} */
  this.totalTimeFontSize = 8;
  /** @type {number} */
  this.defaultStrokeWidth = 1;
  /** @type {number} */
  this.selectedStrokeWidth = 3;
  /** @type {number} */
  this.lineHeight = 25;
  /** @type {number} */
  this.width = 1024;
  /** @type {number} */
  this.graphWidth = 800;
}

/**
 * @return {Array.<NavigationTimingStruct>}
 */
NavigationTimingRenderer.prototype.parse = function() {
  /** @type {NavigationTimingStruct} */
  var struct;
  /** @type {Object} */
  var object = this.object;
  /** @type {Array.<NavigationTimingStruct>} */
  var compact = [];
  /** @type {number} */
  var min = Infinity;
  /** @type {number} */
  var max = -Infinity;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = this.struct.length; i < il; ++i) {
    struct = this.struct[i];

    switch (struct.type) {
      case 'time':
        if (object[struct.name]) {
          struct.start = object[struct.name];
          if (struct.start < min) {
            min = struct.start;
          }
          if (struct.start > max) {
            max = struct.start;
          }
          this.numTime++;
          compact.push(struct);
        }
        break;
      case 'range':
        if (object[struct.name + 'Start'] && object[struct.name + 'End']) {
          struct.start = object[struct.name + 'Start'];
          if (struct.start < min) {
            min = struct.start;
          }
          struct.end   = object[struct.name + 'End'];
          if (struct.end > max) {
            max = struct.end;
          }
          this.numRange++;
          compact.push(struct);
        }
        break;
      default:
        throw new Error('unknown struct type');
    }
  }

  this.min = min;
  this.max = max;

  return compact.sort(function(a, b) {
    return (
      a.type === 'range' && b.type === 'type' ? -1 :
      a.type === 'time' && b.type === 'range' ?  1 :
      a.start < b.start ? -1 :
      a.start > b.start ?  1 : 0
    );
  });
};

/**
 * @type {string}
 * @const
 */
NavigationTimingRenderer.SVGNameSpace = 'http://www.w3.org/2000/svg';

/**
 *
 * @param {string} type
 * @return {SVGElement}
 */
NavigationTimingRenderer.prototype.createElement = function(type) {
  return (
    /** @type {SVGElement} */(
      document.createElementNS(NavigationTimingRenderer.SVGNameSpace, type)
    )
  );
};

/**
 * @param {SVGElement} element
 * @param {Object} attrObj
 */
NavigationTimingRenderer.prototype.setAttributes = function(element, attrObj) {
  /** @type {string} */
  var key;

  for (key in attrObj) {
    if (attrObj.hasOwnProperty(key)) {
      element.setAttribute(key, attrObj[key]);
    }
  }
};

NavigationTimingRenderer.prototype.renderSVG = function() {
  /** @type {Array.<NavigationTimingStruct>} */
  var parsedData = this.parse();
  /** @type {SVGElement} */
  var svg = this.createElement('svg');
  /** @type {number} */
  var min = this.min;
  /** @type {number} */
  var max = this.max;
  /** @type {number} */
  var length = max - min;
  /** @type {number} */
  var width = this.width;
  /** @type {number} */
  var graphWidth = this.graphWidth;
  /** @type {number} */
  var textWidth = width - graphWidth;
  /** @type {number} */
  var padding = this.textPadding;
  /** @type {number} */
  var height = this.lineHeight;
  /** @type {number} */
  var hueStep = 360 / this.numRange;
  /** @type {number} */
  var textPoint =  textWidth - padding;
  /** @type {number} */
  var y = 0;
  /** @type {number} */
  var timeY = 0;

  /** @type {NavigationTimingStruct} */
  var data;

  /** @type {SVGElement} */
  var graph;
  /** @type {SVGElement} */
  var background;
  /** @type {SVGElement} */
  var range;
  /** @type {SVGElement} */
  var time;
  /** @type {SVGElement} */
  var label;
  /** @type {SVGElement} */
  var text;
  /** @type {SVGElement} */
  var rect;
  /** @type {SVGElement} */
  var line;

  /** @type {Function} */
  var mouseover;
  /** @type {Function} */
  var mouseout;

  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  if (parsedData.length === 0) {
    return;
  }

  this.setAttributes(svg, {
    'width': width,
    'height': height * (this.numRange + this.numTime)
  });

  graph = this.createElement('g');
  background = this.createElement('g');
  range = this.createElement('g');
  time = this.createElement('g');
  label = this.createElement('g');

  line = this.createElement('line');
  this.setAttributes(line, {
    'x1': textWidth - 0.5,
    'y1': 0,
    'x2': textWidth - 0.5,
    'y2': height * (this.numRange + this.numTime),
    'stroke': 'black',
    'stroke-width': 1
  });
  svg.appendChild(line);

  graph.setAttribute('transform', 'translate(' + textWidth + ',0)');
  label.setAttribute('font-size', this.labelFontSize);

  svg.appendChild(graph);
  graph.appendChild(background);
  graph.appendChild(range);
  graph.appendChild(time);
  svg.appendChild(label);

  for (i = 0, il = parsedData.length; i < il; ++i) {
    data = parsedData[i];
    switch (data.type) {
      case 'range':
        // border
        if (y < this.numRange) {
          line = this.createElement('line');
          this.setAttributes(line, {
            'x1': -textWidth,
            'y1': (y + 1) * height + 0.5,
            'x2': graphWidth,
            'y2': (y + 1) * height + 0.5,
            'stroke': y + 1 === this.numRange ? 'black' : 'rgb(128,128,128)',
            'stroke-width': 1
          });
          background.appendChild(line);
        }

        // text
        text = this.createElement('text');
        this.setAttributes(text, {
          'alignment-baseline': 'central',
          'text-anchor': 'end',
          'x': textPoint,
          'y': (y + 0.5) * height
        });
        text.textContent = data.name;
        label.appendChild(text);

        // rect
        rect = this.createElement('rect');
        this.setAttributes(rect, {
          'x': (data.start - min) / length * graphWidth,
          'y': y * height,
          'rx': 3,
          'rt': 3,
          'width': ((data.end - data.start) / length * graphWidth) || 0.1,
          'height': height,
          'stroke': 'hsl(' + (y * hueStep) + ', 50%, 30%)',
          'stroke-width': this.defaultStrokeWidth,
          'fill': 'hsl(' + (y * hueStep) + ', 50%, 50%)'
        });
        range.appendChild(rect);

        // tooltip
        title = this.createElement('title');
        title.textContent = 'start: ' + (data.start - min) + ' ms, duration: ' + (data.end - data.start) + ' ms';
        text.appendChild(title);
        rect.appendChild(title.cloneNode(true));

        // event
        mouseover = (function(renderer, text, rect) {
          return function(event) {
            text.setAttribute('font-weight', 'bold');
            rect.setAttribute('stroke-width', renderer.selectedStrokeWidth);
          }
        })(this, text, rect);
        mouseout = (function(renderer, text, rect) {
          return function(event) {
            text.setAttribute('font-weight', 'normal');
            rect.setAttribute('stroke-width', renderer.defaultStrokeWidth);
          }
        })(this, text, rect);
        text.addEventListener('mouseover', mouseover, false);
        text.addEventListener('mouseout', mouseout, false);
        rect.addEventListener('mouseover', mouseover, false);
        rect.addEventListener('mouseout', mouseout, false);

        y++;
        break;
      case 'time':
        // text
        text = this.createElement('text');
        this.setAttributes(text, {
          'alignment-baseline': 'central',
          'text-anchor': 'end',
          'x': textPoint,
          'y': height * (this.numRange + timeY + 0.5),
        });
        text.textContent = data.name;
        label.appendChild(text);

        //line
        line = this.createElement('polyline');
        this.setAttributes(line, {
          'points': [
            [(data.start - min) / length * graphWidth,                                    0].join(' '),
            [(data.start - min) / length * graphWidth, height * this.numRange              ].join(' '),
            [                                       0, height * (this.numRange + 1 + timeY)].join(' '),
            [                              -textWidth, height * (this.numRange + 1 + timeY)].join(' ')
          ].join(','),
          'stroke': 'rgb(192, 0, 0)',
          'stroke-width': this.defaultStrokeWidth,
          'fill': 'none'
        });
        time.appendChild(line);

        // tooltip
        title = this.createElement('title');
        title.textContent = 'start: ' + (data.start - min) + ' ms';
        text.appendChild(title);
        line.appendChild(title.cloneNode(true));

        // event
        mouseover = (function(renderer, text, line) {
          return function(event) {
            text.setAttribute('font-weight', 'bold');
            line.setAttribute('stroke-width', renderer.selectedStrokeWidth);
          }
        })(this, text, line);
        mouseout = (function(renderer, text, line) {
          return function(event) {
            text.setAttribute('font-weight', 'normal');
            line.setAttribute('stroke-width', renderer.defaultStrokeWidth);
          }
        })(this, text, line);
        text.addEventListener('mouseover', mouseover, false);
        text.addEventListener('mouseout', mouseout, false);
        line.addEventListener('mouseover', mouseover, false);
        line.addEventListener('mouseout', mouseout, false);

        timeY++;
        break;
    }
  }

  // text
  text = this.createElement('text');
  this.setAttributes(text, {
    'font-size': this.totalTimeFontSize,
    'alignment-baseline': 'central',
    'text-anchor': 'end',
    'x': width - padding,
    'y': height * (this.numRange + 0.5)
  });

  text.textContent = length + ' ms';
  label.appendChild(text);

  return svg;
};

function NavigationTimingStruct(name, type) {
  /** @type {string} */
  this.name = name;
  /** @type {string} */
  this.type = type;
  /** @type {number} */
  this.start = 0;
  /** @type {number} */
  this.end = 0;
}

/**
 * @param {Object} obj
 * @return {Array.<NavigationTimingStruct>}
 */
NavigationTimingRenderer.prototype.createStructFromObject = function(obj) {
  /** @type {Object} */
  var exclude = {};
  /** @type {string} */
  var key;
  /** @type {Array.<string>} */
  var keys = Object.keys(obj).sort();
  /** @type {Array.<NavigationTimingStruct>} */
  var structs = [];
  /** @type {string} */
  var basename;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (i = 0, il = keys.length; i < il; ++i) {
    key = keys[i];

    if (key in exclude) {
      continue;
    }

    // Range: Start -> End
    if ((key.length > 5 && key.slice(-5)) === 'Start') {
      basename = key.slice(0, -5);
      if (basename + 'End' in obj) {
        structs.push(new NavigationTimingStruct(basename, 'range'));
        exclude[basename + 'End'] = true;
        continue;
      }
    }

    // Range: End -> Start
    if ((key.length > 3 && key.slice(-3)) === 'End') {
      basename = key.slice(0, -3);
      if (basename + 'Start' in obj) {
        structs.push(new NavigationTimingStruct(basename, 'range'));
        exclude[basename + 'Start'] = true;
        continue;
      }
    }

    // Time
    structs.push(new NavigationTimingStruct(key, 'time'));
  }

  return structs;
};


