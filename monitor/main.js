(function(global) {

/** @type {BirdSociery} */
var bs = BirdSociety.connect();
/** @type {string} */
var currentChannel;

/**
 * update method.
 * @param {!Object} received 受信オブジェクト.
 */
bs.update = function(received) {
  switch (received.message.type) {
    case 'log':   /* FALLTHROUGH */
    case 'warn':  /* FALLTHROUGH */
    case 'error':
      updateLog(received);
      break;
    case 'stat':
      updateGraph(received.message.date, received.message.data);
      break;
    case 'callgraph':
      // XXX
      break;
    default:
      throw new Error('unknown data type:' + received.message.type);
  }
};

/**
 * update channel list.
 * @param {Array} チャンネル名の一覧
 */
bs.listUpdate = function(list) {
  /** @type {HTMLDivElement} */
  var target = id('list-container');
  /** @type {HTMLElement} */
  var ul = document.createElement('ul');
  /** @type {HTMLElement} */
  var li;
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  while (target.childNodes.length > 0) {
    target.removeChild(target.firstChild);
  }

  for (i = 0, il = list.length; i < il; ++i) {
    li = document.createElement('li');
    li.innerHTML = '<a href="#'+ list[i] +'">' + list[i] + '</a>';
    ul.appendChild(li);
  }

  target.appendChild(ul);
};

// document.getElementById shortcut
function id(identifier) { return document.getElementById(identifier); }

/**
 * @type {!Object}
 * @const
 */
var Config = {
  DefaultLineWidth: 1,
  StrongLineWidth: 5,
  Lines: 30,
  LogScrollCheckboxId: 'log-scroll',
  LogStopCheckboxId: 'log-stop',
  LogLines: 1000
};

/**
 * @type {Array.<!Object>}
 * @const
 */
var GraphList = [
  {
    chart: {},
    line: {},
    target: ['self', 'total', 'count'],
    chartSuffix: '-graph',
    legendSuffix: '-legend',
    dataFilter: createPlainData,
    viewFilter: dummyFilter, //top30,
    trCache: {}
  },
  {
    chart: {},
    line: {},
    target: ['self', 'total', 'count'],
    chartSuffix: '-sub-graph',
    legendSuffix: '-sub-legend',
    dataFilter: createSubData,
    viewFilter: dummyFilter, // top30
    trCache: {}
  }
];

/**
 * @enum {number}
 */
var Mode = {
  GRAPH: 0,
  LIST: 1
};

/**
 * @param {Mode} mode current mode.
 */
function init(mode) {
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;
  /** @type {!Object} */
  var graph;
  /** @type {Array.<string>} */
  var targets;
  /** @type {string} */
  var target;

  for (i = 0, il = GraphList.length; i < il; ++i) {
    graph = GraphList[i];
    graph.line = {};
    graph.trCache = {};
    graph.viewFilter = (function(num) {
      return function() {
        return topFilter(arguments[0], arguments[1], num);
      };
    })(Config.Lines);

    targets = graph.target;

    // remove old chart
    for (target in graph.chart) {
      if (graph.chart[target] instanceof SmoothieChart) {
        graph.chart[target].stop();
        delete graph.chart[target];
      }
      element = id(target + graph.legendSuffix);
      while (element.childNodes.length > 0) {
        element.firstChild.dispose();
        element.removeChild(element.firstChild);
      }
    }
    graph.chart = {};

    // モード毎の処理(1)
    switch (mode) {
      // リスト表示時には新しいグラフを作らない
      case Mode.LIST:
        break;
      // create new chart
      case Mode.GRAPH:
        for (j = 0, jl = targets.length; j < jl; ++j) {
          target = targets[j];
          addChart(graph.chart, target, id(target + graph.chartSuffix));
        }

        // current status
        graph.stopped = false;

        // create button event
        (function (graph) {
          id('start' + graph.chartSuffix).addEventListener('click', function() {
            startGraph(graph);
          }, false);
          id('stop' + graph.chartSuffix).addEventListener('click', function() {
            stopGraph(graph);
          }, false);
        })(graph);
        break;
    }
  }

  // モード毎の表示設定
  switch (mode) {
    case Mode.GRAPH:
      id('graph-container').style.display =
      id('log-container').style.display = 'block';
      id('list-container').style.display = 'none';
      break;
    case Mode.LIST:
      id('graph-container').style.display =
      id('log-container').style.display = 'none';
      id('list-container').style.display = 'block';
      break;
  }
}

// hashchange handler
window.addEventListener('hashchange', onHashChange, false);
function onHashChange(ev) {
  if (location.pathname.length > 1) {
    Config.Lines = +location.pathname.slice(1);
  }
  if (location.hash.length > 1) {
    join(location.hash.slice(1));
    init(Mode.GRAPH);
  } else {
    bs.list();
    if (currentChannel) {
      bs.leave(currentChannel);
    }
    init(Mode.LIST);
  }

  if (ev instanceof Event) {
    ev.preventDefault();
  }

  return false;
}

// onload
document.addEventListener('DOMContentLoaded', function onload() {
  /** @type {number} */
  var retry = 100;
  /** @type {number} */
  var timerId;

  // once
  document.removeEventListener('DOMContentLoaded', onload);

  // 接続待ち
  timerId = setInterval(function() {
    if (!bs.connected) {
      if (--retry === 0) {
        console.log("connection failed");
        clearInterval(timerId);
      }
      return;
    }

    onHashChange();
    clearInterval(timerId);
  }, 100);
}, false);

/**
 * @param {string} channel channel name.
 */
function join(channel) {
  if (currentChannel) {
    bs.leave(currentChannel);
  }
  bs.join(channel);
  currentChannel = channel;
}

/**
 * グラフの更新
 * @param {number} date date number.
 * @param {!Object} obj target object.
 * @private
 */
var updateGraph = (function(){
  /** @type {!Object} */
  var prev = {};

  return function(date, obj) {
    /** @type {!Object} */
    var graph;
    /** @type {!Object} */
    var data;
    /** @type {number} */
    var i;
    /** @type {number} */
    var il;
    /** @type {!Object} */
    var keys;

    for (i = 0, il = GraphList.length; i < il; ++i) {
      graph = GraphList[i];

      if (graph.stopped) {
        continue;
      }

      data = graph.dataFilter(graph.chart, obj, prev);

      keys = updateTimeSeries(graph, data, date);
      updateLegend(graph, data, keys);
    }

    prev = obj;
  }
})();

/**
 * start graph update.
 * @param {!Object} graph graph.
 */
function startGraph(graph) {
  /** @type {!Object} */
  var chart = graph.chart;
  /** @type {string} */
  var target;

  for (target in chart) {
    chart[target].start();
  }

  // current status
  graph.stopped = false;
}

  /**
/**
 * stop graph update.
 * @param {!Object} graph graph.
 */
function stopGraph(graph) {
  /** @type {!Object} */
  var chart = graph.chart;
  /** @type {string} */
  var target;

  for (target in chart) {
    chart[target].stop();
  }

  // current status
  graph.stopped = true;
}

/**
 * SmoothieChart の追加.
 * @param {!Object} graphObj graphs.
 * @param {string} target target data name.
 * @param {HTMLCanvasElement} element target canvas element.
 * @private
 */
function addChart(graphObj, target, element) {
  graphObj[target] = new SmoothieChart({
    interpolation: 'line',
    fps: 5,
    millisPerPixel: 100,
    scaleSmoothing: 0, // ??
    maxValueScale: 1.1,
  });
  graphObj[target].streamTo(element);
}

/**
 * データの作成.
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @param {!Object=} prev previous graph data object.
 * @return {!Object} data object.
 * @private
 */
function createPlainData(graph, data, prev) {
  return data;
}

/**
 * 現在のデータと前回のデータから差分データの作成.
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @param {!Object=} prev previous graph data object.
 * @return {!Object} sub data object.
 * @private
 */
function createSubData(graph, data, prev) {
  /** @type {string} */
  var prop;
  /** @type {string} */
  var target;
  /** @type {number} */
  var sub;
  /** @type {!Object} */
  var subdata = {};

  for (prop in data) {
    subdata[prop] = {};
    for (target in graph) {
      sub = (prev && prev[prop] && prev[prop][target]) || 0;
      subdata[prop][target] = data[prop][target] - sub;
    }
  }

  return subdata;
}

/**
 * 時系列データの更新.
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @param {number} date date number.
 * @return {!Object} グラフごとの表示するメソッド名のリスト.
 * @private
 */
function updateTimeSeries(graph, data, date) {
  /** @type {!Object} */
  var chart = graph.chart;
  /** @type {!Object} */
  var map = graph.line;
  /** @type {string} */
  var prop;

  for (prop in data) {
    if (!map[prop]) {
      map[prop] = {};
      map[prop].lineColor =
        hsv2rgba(Math.random() * 360 | 0, 0.5, 1, 1);

      for (target in chart) {
        map[prop][target] = new TimeSeries();
        map[prop][target].option = {
          strokeStyle: map[prop].lineColor,
          lineWidth: Config.DefaultLineWidth
        };
        chart[target].addTimeSeries(
          map[prop][target],
          map[prop][target].option
        );
      }
    }
    for (target in chart) {
      map[prop][target].append(date, data[prop][target]);
      map[prop][target].option.skip = true;
    }
  }

  return graph.viewFilter(graph, data);
}

/**
 * 凡例の更新.
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @param {!Object} display グラフごとの表示するメソッド名のリスト.
 * @private
 */
function updateLegend(graph, data, display) {
  /** @type {!Object} */
  var chart = graph.chart;
  /** @type {string} */
  var suffix = graph.legendSuffix;
  /** @type {string} */
  var target;
  /** @type {HTMLTableElement} */
  var element;

  for (target in chart) {
    element = id(target + suffix);

    updateDataTable(element, display[target].length);
    appendData(element, display[target], graph, data, target);
  }
}

function updateDataTable(element, num) {
  var tr;
  var td;

  if (element.childNodes.length === num) {
    return;
  }

  while (element.childNodes.length < num) {
    tr = document.createElement('tr');

    td = document.createElement('td');
    td.style.width = '1em';
    tr.appendChild(td);

    td = document.createElement('td');
    tr.appendChild(td);

    td = document.createElement('td');
    td.style.textAlign = 'right';
    tr.appendChild(td);

    element.appendChild(tr);
  }

  while (element.childNodes.length > num) {
    element.removeChild(element.firstChild);
  }
}

/**
 * データを任意の順番で TR 要素文字列に変換.
 * @param {HTMLElement} element target element.
 * @param {Array.<string>} sortedKeys sorted label and data array.
 * @param {!Object} data data object.
 * @param {!string} target target data name.
 * @private
 */
function appendData(element, sortedKeys, graph, data, target) {
  /** @type {!Object} */
  var map = graph.line;
  /** @type {Array.<string>} */
  var part = [];
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;
  /** @type {string} */
  var prop;
  /** @type {string} */
  var color;
  /** @type {HTMLElement} */
  var tr;
  /** @type {HTMLElement} */
  var td;

  for (i = 0, il = element.childNodes.length; i < il; ++i) {
    prop = sortedKeys[i];
    color = map[prop].lineColor;

    tr = element.childNodes[i];
    tr.setAttribute('data-target-name', target);
    tr.setAttribute('data-property-name', prop);

    var values = tr.getElementsByTagName('td');
    values[0].style.backgroundColor = color;
    values[1].textContent = prop;
    values[2].textContent = (data[prop][target] * 100 + 0.5 | 0) / 100;

    // set event listener
    if (tr.dispose !== void 0) {
      tr.dispose();
    }
    function onMouseOver(ev) {
      var target = this.getAttribute('data-target-name');
      var prop = this.getAttribute('data-property-name');

      LineHighlight(this, map[prop][target].option);
    }
    tr.addEventListener('mouseover', onMouseOver, false);
    tr.dispose = function() {
      this.removeEventListener('mouseover', onMouseOver);
    };
  }
}

/**
 * 線の強調.
 * @param {HTMLTableRowElement} 凡例の行要素.
 * @param {!object} 現在の線のオプション.
 */
var LineHighlight = (function() {
  /**
   * @type {!{
   *   element: ?HTMLTableRowElement,
   *   option: ?Object
   * }}
   */
  var prev = {element: null, option: null};

  return function(element, option) {
    if (prev.option) {
      prev.element.classList.remove('select');
      prev.option.lineWidth = Config.DefaultLineWidth;
    }

    element.classList.add('select');
    option.lineWidth = Config.StrongLineWidth;

    prev.element = element;
    prev.option = option;
  }
})();

/**
 * ログの更新
 * @param {!Object} data データオブジェクト.
 * @private
 */
function updateLog(data) {
  /** @type {HTMLDListElement} */
  var log = id('output');
  /** @type {HTMLElement} */
  var now  = document.createElement('dt');
  /** @type {HTMLElement} */
  var type = document.createElement('dt');
  /** @type {HTMLElement} */
  var json = document.createElement('dd');
  /** @type {string} */
  var color = 'rgb(' + (
    data.message.type === 'warn'  ? [255, 255, 128] :
    data.message.type === 'error' ? [255, 192, 192] :
  /*data.message.type === 'log'  */ [255, 255, 255]
  ).join(',') + ')';

  if (id(Config.LogStopCheckboxId).checked) {
    return;
  }

  now.style.float = 'left';
  now.style.marginRight = '1em';
  now.style.color = color;
  now.title = new Date(data.message.date);

  type.style.float = 'left';
  type.style.marginRight = '1em';
  type.style.color = color;

  json.style.color = color;
  json.title = JSON.stringify(data.message.data, null, '  ');

  now.innerText = data.message.date;
  type.innerText = data.message.type;
  json.innerText = JSON.stringify(data.message.data);

  output.appendChild(now);
  output.appendChild(type);
  output.appendChild(json);

  // 3 = now + type + json
  while (output.childNodes.length > Config.LogLines * 3) {
    output.removeChild(output.firstChild);
  }

  if (id(Config.LogScrollCheckboxId).checked) {
    output.scrollTop = output.scrollHeight;
  }
}

function dummyFilter(graph, data) {
  return topFilter(graph, data, Infinity);
}
/**
 * 上位 30 件フィルタ
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @return {!Object} グラフごとの表示するメソッド名のリスト.
 */
function top30(graph, data) {
  return topFilter(graph, data, 30);
}

/**
 * 汎用上位 n 件フィルタ
 * @param {!Object} graph graph data object.
 * @param {!Object} data data object.
 * @param {number} n 表示する件数.
 * @return {!Object} グラフごとの表示するメソッド名のリスト.
 */
function topFilter(graph, data, n) {
  /** @type {!Object} */
  var chart = graph.chart;
  /** @type {!Object} */
  var map = graph.line;
  /** @type {Array.<string>} */
  var sortedKeys;
  /** @type {!Object} */
  var display = {};
  /** @type {number} */
  var i;
  /** @type {number} */
  var il;

  for (target in chart) {
    display[target] = [];

    sortedKeys = Object.keys(data).sort(function(a, b) {
      return data[a][target] > data[b][target] ? -1
           : data[a][target] < data[b][target] ?  1
           : graph.line[a][target].maxValue > graph.line[b][target].maxValue ? -1
           : graph.line[a][target].maxValue < graph.line[b][target].maxValue ?  1
           : 0;
    });

    for (i = 0, il = sortedKeys.length; i < il; ++i) {
      if (i === n) {
        break;
      }
      map[sortedKeys[i]][target].option.skip = false;
      display[target][i] = sortedKeys[i];
    }
  }

  return display;
}

/**
 * HSVA の値から RGBA 文字列へ変換.
 * @param {number} h hue 0-360 number.
 * @param {number} s saturation (0.0-1.0).
 * @param {number} v value (0.0-1.0)
 * @param {number} a alpha (0.0-1.0)
 * @return {string} RGBA string.
 * @private
 */
function hsv2rgba(h, s, v, a) {
  /** @type {number} @const */
  var m = h % 360;
  /** @type {number} @const */
  var i = m / 60 | 0;
  /** @type {number} @const */
  var f = m / 60 - i;
  /** @type {number} @const */
  var p = v * (1 - s);
  /** @type {number} @const */
  var q = v * (1 - f * s);
  /** @type {number} @const */
  var t = v * (1 - (1 - f) * s);

  return ['rgba(', (
    i === 0 ? [v * 255 | 0, t * 255 | 0, p * 255 | 0, a] :
    i === 1 ? [q * 255 | 0, v * 255 | 0, p * 255 | 0, a] :
    i === 2 ? [p * 255 | 0, v * 255 | 0, t * 255 | 0, a] :
    i === 3 ? [p * 255 | 0, q * 255 | 0, v * 255 | 0, a] :
    i === 4 ? [t * 255 | 0, p * 255 | 0, v * 255 | 0, a] :
    i === 5 ? [v * 255 | 0, p * 255 | 0, q * 255 | 0, a] : []
  ).join(','), ')'].join('');
}

}).call(this, this);
