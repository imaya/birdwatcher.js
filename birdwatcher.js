/**
 * @license
 * birdwatcher.js
 * JavaScript Profiler
 * https://github.com/imaya/birdwatcher.js
 *
 * The MIT License
 *
 * Copyright (c) 2012 imaya
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(function (global) {
  /** @define {string} profiler function name */
  var name = 'BirdWatcher';

  this[name] = BirdWatcher;

  /**
   * new profiler
   * @param {Array.<string>} target target prototype objects.
   * @constructor
   */
  function BirdWatcher(target) {
    /** @type {Array.<string>} target function/object string list. */
    this.target = target;
    /** @type {Obejct} wrapped function list */
    this.wrapped = {};
    /** @type {Array.<string>} call stack. */
    this.stack = [];
    /** @type {Object} callgraph object. */
    this.callgraph = {};
    /** @type {number} max depth. */
    this.maxDepth = 10;
  }

  /**
   * start profiling.
   */
  BirdWatcher.prototype.start = function(maxDepth) {
    var target = this.target;
    /** @type {number} loop counter */
    var i;
    /** @type {number} loop limiter */
    var il;

    if (typeof maxDepth === 'number') {
      this.maxDepth = maxDepth;
    }

    for (i = 0, il = target.length; i < il; ++i) {
      this.wrap(target[i], 0);
    }
  };

  /**
   * stop profiling.
   */
  BirdWatcher.prototype.stop = function() {
    var wrapped = this.wrapped;
    /** @type {Array.<string>} function name parts */
    var parts;
    /** @type {string} function name */
    var method;
    /** @type {*} parent object */
    var parent;
    /** @type {number} wrapped function name */
    var i;

    // Object.keys ŽÀ‘•ˆÈ‘O‚Ìˆ—Œn‚É‘Î‰ž‚·‚é‚½‚ß for-in ‚Å‚Ü‚í‚·
    for (i in wrapped) {
      parts = i.split('.');

      method = parts.pop();
      parent = (parts.length > 0) ? eval(parts.join('.')) : global;

      if (parent[method] !== wrapped[i].source) {
        parent[method] = wrapped[i].source;
      }
    }
  };

  /**
   * wrapper.
   * @param {string} name function name string.
   * @param {number} depth current depth.
   */
  BirdWatcher.prototype.wrap = function(name, depth) {
    /** @type {*} target object */
    var obj;
    /** @type {!Array.<string>} function name string parts, divide by '.' */
    var parts;
    /** @type {string} method method name. */
    var method;
    /** @type {*} parent object */
    var parent;
    /** @type {number} loop counter */
    var i;
    /** @type {number} loop limiter */
    var il;
    /** @type {BirdWatcher} myself */
    var that = this;
    /** @type {string} property nane */
    var prop;
    /** @type {function} wrapper function */
    var wrapFunc;

    // depth limiter
    if (depth === this.maxDepth) {
      return;
    }

    parts = name.split('.');
    obj = eval(name);

    switch (typeof obj) {
      // function
      case 'function':
        // setup
        if (this.wrapped[name] === void 0) {
          this.wrapped[name] = {
            source: obj,
            self: 0,
            total: 0,
            count: 0
          };
        }

        // wrap
        if (typeof this.wrapped[name] === 'object') {
          method = parts.pop();
          parent = parts.length > 0 ? eval(parts.join('.')) : global;

          this.callgraph[name] = {};

          // constructor
          parent[method] = (function(name) {
              // prototype wrapper
              for (prop in obj.prototype) {
                if (typeof(obj.prototype[prop]) === 'function') {
                  that.wrap.call(
                    that,
                    parts.concat(method, 'prototype').join('.') + "['" + prop + "']",
                    depth + 1
                  );
                }
              }

              /**
               * wrap constructor function.
               * @return {*} original fnction's return value.
               * @private
               */
              var func = this[name] = function() {
                /** @type {function} original function */
                var sourceFunc = that.wrapped[name].source;
                /** @type {Array} wrapped function list */
                var wrapped = that.wrapped;
                /** @type {Array} call stack */
                var stack = that.stack;
                /** @type {number} start time */
                var start;
                /** @type {*} original function's return value */
                var retval;
                /** @type {number} end time */
                var end;
                /** @type {number} run time */
                var sub;
                /** @type {name} prev stack name */
                var prev;
                /** @type {Object} callgraph */
                var callgraph = that.callgraph;

                // benchmarks
                stack.push(name);

                start = Date.now ? Date.now() : new Date();
                retval = sourceFunc.apply(this, arguments);
                end = Date.now ? Date.now() : new Date();

                stack.pop();

                // profiler countup
                sub = end - start;
                ++wrapped[name].count;
                wrapped[name].total += sub;
                wrapped[name].self += sub;


                // calculate self-time and callgraph
                if (stack.length > 0) {
                  prev = stack[stack.length - 1];
                  wrapped[prev].self -= sub;
                  callgraph[prev][name] = callgraph[prev][name] + 1 || 1;
                }

                return retval;
              };

              // copy property
              for (prop in obj) {
                func[prop] = obj[prop];
              }

              // copy prototype
              func.prototype = obj.prototype;

              return func;
          }).call(global, name);
        }
        break;
      // namespace
      case 'object':
        if (obj !== null) {
          for (i in obj) {
            this.wrap(parts + "['" + i + "']", depth + 1);
          }
        }
        break;
    }
  };

  /**
   * report profiling result.
   */
  BirdWatcher.prototype.report = function() {
    if (console && typeof console.log === 'function') {
      console.log(this.reportString());
      console.log(this.reportCallgraphString());
    }
  };

  /**
   * report callgraph string.
   * @return {string} callgraph string.
   */
  BirdWatcher.prototype.reportCallgraphString = function() {
    /** @type {string} call-start function name */
    var from;
    /** @type {string} call-end function name */
    var to;
    /*: @type {Array.<Array>} lines buffer */
    var lines = [];
    /** @type {Array} line buffer */
    var line;
    /** @type {Array.<string>} output buffer */
    var result = [];
    /** @type {Array.<number>} max string length */
    var max = [0, 0, 0];
    /** @type {*} temporary variable for calculation */
    var tmp;
    /** @type {number} loop counter */
    var i;
    /** @type {number} loop limiter */
    var il;
    /** @type {number} loop counter */
    var j;
    /** @type {number} loop limiter */
    var jl;
    /** @type {Object} callgraph object shortcut */
    var callgraph = this.callgraph;

    // head
    line = ['from', 'to', 'count'];
    for (i = 0, il = line.length; i < il; ++i) {
      max[i] = Math.max(max[i], ('' + line[i]).length);
    }
    lines.push(line);

    // body
    for (from in callgraph) {
      i = callgraph[from];
      for (to in i) {
        if (i[to] > 0) {
          // line
          line = [from, to, i[to]];
          lines.push(line);

          // max
          for (tmp = 0, il = line.length; tmp < il; ++tmp) {
            max[tmp] = Math.max(max[tmp], ('' + line[tmp]).length);
          }
        }
      }
    }

    // print
    for(i = 0, il = lines.length; i < il; ++i) {
      line = lines[i];

      // print
      tmp = [];
      for (j = 0, jl = line.length; j < jl; ++j) {
        tmp[j] = x(' ', max[j] - (''+line[j]).length) + line[j];
      }
      result.push(tmp.join(' '));

      // head/body separator
      if (i === 0) {
        tmp = 0;
        for (j = 0, jl = max.length; j < jl; ++j) {
          tmp += max[j];
        }
        result.push(x('-', tmp + max.length - 1));
      }
    }

    return result.join("\n");
  };

  /**
   * report profile string.
   * @return {string} profiling result.
   */
  BirdWatcher.prototype.reportString = function() {
    /** @type {Array.<string>} object keys */
    var keys = [];
    /** @type {number} loop counter */
    var i;
    /** @type {number} loop limiter */
    var il;
    /** @type {number} loop counter */
    var j;
    /** @type {number} loop limiter */
    var jl;
    /** @type {string} function name */
    var name;
    /** @type {Array.<number>} max string length */
    var max = [0, 0, 0, 0];
    /** @type {Object} wrapped function list */
    var wrapped = this.wrapped;
    /** @type {Array.<Arry>} lines buffer */
    var lines = [];
    /** @type {Array} line buffer */
    var line;
    /** @type {Array} output buffer */
    var result = [];
    /** @type {*} temporary variable for calulation */
    var tmp;

    for (i in wrapped) {
      keys.push(i);
    }

    keys.sort(function(a, b) {
        return wrapped[a].self > wrapped[b].self ? -1 :
               wrapped[a].self < wrapped[b].self ? 1 :
               0;
    });

    // header
    line = ["function", "count", "total(ms)", "self(ms)"];
    for (i = 0, il = line.length; i < il; ++i) {
      max[i] = Math.max(max[i], ('' + line[i]).length);
    }
    lines.push(line);

    // body
    for (i = 0, il = keys.length; i < il; ++i) {
      name = keys[i];
      line = [name, wrapped[name].count, wrapped[name].total, wrapped[name].self];
      lines.push(line);

      // max
      for (j = 0, jl = line.length; j < jl; ++j) {
        max[j] = Math.max(max[j], ('' + line[j]).length);
      }
    }

    // print
    for(i = 0, il = lines.length; i < il; ++i) {
      line = lines[i];

      // count > 0
      if (i === 0 || line[1] > 0) {
        tmp = [];
        for (j = 0, jl = line.length; j < jl; ++j) {
          tmp[j] = x(' ', max[j] - (''+line[j]).length) + line[j];
        }
        result.push(tmp.join(' '));
      }
      // head/body separator
      if (i === 0) {
        tmp = 0;
        for (j = 0, jl = max.length; j < jl; ++j) {
          tmp += max[j];
        }
        result.push(x('-', tmp + max.length - 1));
      }
    }

    return result.join("\n");
  };

  /**
   * generate repeated string.
   * @param {string} c source string.
   * @param {number} num repeat times.
   * @return {string} repeated string.
   * @private
   */
  function x(c, num) {
    var str = '';
    while (num--) {
      str += c;
    }
    return str;
  }

// end of scope
}).call(this, this);

/* vim:set expandtab ts=2 sw=2 tw=80: */
