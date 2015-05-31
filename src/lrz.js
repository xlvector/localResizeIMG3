/**
 * lrz3
 * https://github.com/think2011/localResizeIMG3
 * @author think2011
 */
;
(function() {
    window.URL = window.URL || window.webkitURL;
    var ua = detect.parse(navigator.userAgent);

    /**
     * 客户端压缩图片
     * @param file
     * @param [options]
     * @param callback
     * @constructor
     */
    function Lrz(file, options, callback) {
      this.file = file;
      this.callback = callback;
      this.defaults = {
        quality: 0.7
      };

      // 适应传入的参数
      if (callback) {
        for (var p in options) {
          this.defaults[p] = options[p];
        }
        if (this.defaults.quality > 1) this.defaults.quality = 1;
      } else {
        this.callback = options;
      }

      this.results = {
        origin: null,
        base64: null,
        base64Len: null
      };

      this.init();
    }

    Lrz.prototype = {
      constructor: Lrz,

      /**
       * 初始化
       */
      init: function() {
        var that = this;

        that.create(that.file, that.callback);
      },

      /**
       * 生成base64
       * @param file
       * @param callback
       */
      create: function(file, callback) {
        var that = this,
          img = new Image(),
          results = that.results,
          blob = (typeof file === 'string') ? file : URL.createObjectURL(file);
        img.src = blob;
        img.crossOrigin = "*";
        img.onload = function() {
            // 获得图片缩放尺寸
            var resize = that.resize(this);

            EXIF.getData(img, function() {
                var orientation = EXIF.getTag(this, "Orientation");
                // 初始化canvas
                var canvas = document.createElement('canvas'),
                  ctx;

                // 根据旋转重置尺寸
                that.rotateResize(resize, orientation);

                canvas.width = resize.w;
                canvas.height = resize.h;
                ctx = canvas.getContext('2d');

                // 渲染画布
                ctx.fillStyle = '#fff';
                ctx.fillRect(0, 0, resize.w, resize.h);

                // 生成结果
                results.origin = file;

                // 兼容iOS6/iOS7
                if (ua.os.family === 'iOS' && +ua.os.version < 8) {

                  var mpImg = new MegaPixImage(img);

                  mpImg.render(canvas, {
                    width: canvas.width,
                    height: canvas.height,
                    orientation: orientation
                  });

                  results.base64 = canvas.toDataURL('image/jpeg', that.defaults.quality);

                  // 执行回调
                  _callback(results);

                }
                // 其他设备&IOS8+
                else {
                  switch (orientation) {
                    case 3:
                      ctx.rotate(180 * Math.PI / 180);
                      ctx.drawImage(img, -resize.w, -resize.h, resize.w, resize.h);
                      break;

                    case 6:
                      canvas.width = resize.h;
                      canvas.height = resize.w;
                      ctx.rotate(90 * Math.PI / 180);
                      ctx.drawImage(img, 0, -resize.h, resize.w, resize.h);
                      break;

                    case 8:
                      canvas.width = resize.h;
                      canvas.height = resize.w;
                      ctx.rotate(270 * Math.PI / 180);
                      ctx.drawImage(img, -resize.w, 0, resize.w, resize.h);
                      break;

                    default:
                      ctx.drawImage(img, 0, 0, resize.w, resize.h);
                  }

                  if (ua.os.family === 'Android' && ua.os.version < 4.5) {
                    var encoder = new JPEGEncoder();
                    results.base64 = encoder.encode(ctx.getImageData(0, 0, canvas.width, canvas.height), that.defaults.quality * 100);
                  } else {
                    results.base64 = canvas.toDataURL('image/jpeg', that.defaults.quality);
                  }
                  results.base64 = canvas.toDataURL('image/jpeg', that.defaults.quality);

                  // 执行回调
                  _callback(results);

                }
              });


              /**
               * 包装回调
               */
              function _callback(results) {
                // 释放内存
                canvas = null;
                img = null;
                URL.revokeObjectURL(blob);

                // 加入base64Len，方便后台校验是否传输完整
                results.base64Len = results.base64.length;

                callback(results);
              }
            };
          },

          /**
           * 获得图片的缩放尺寸
           * @param img
           * @returns {{w: (Number), h: (Number)}}
           */
          resize: function(img) {
            var w = this.defaults.width,
              h = this.defaults.height,
              scale = img.width / img.height,
              ret = {
                w: img.width,
                h: img.height
              };

            if (w & h) {
              ret.w = w;
              ret.h = h;
            } else if (w) {
              ret.w = w;
              ret.h = Math.ceil(w / scale);
            } else if (h) {
              ret.w = Math.ceil(h * scale);
              ret.h = h;
            }

            // 超过这个值base64无法生成，在IOS上
            if (ret.w >= 3264 || ret.h >= 2448) {
              ret.w *= 0.8;
              ret.h *= 0.8;
            }

            return ret;
        },

        /**
         * 根据旋转角度重置之前设定的宽高
         * @param resize
         * @param orientation
         * @return
         */
        rotateResize: function (resize, orientation) {
            switch (orientation) {
                case 6:
                case 8:
                    if(this.defaults.width && this.defaults.height) {
                        var oldW = resize.w, oldH = resize.h;

                        resize.w = oldH;
                        resize.h = oldW;
                        return false;
                    }

                    var diffVal;

                    if(this.defaults.width) {
                        if(resize.w > resize.h) {
                            diffVal = resize.w - resize.h;
                            resize.w += diffVal;
                            resize.h += diffVal;
                        }
                        else if (resize.w < resize.h) {
                            diffVal = resize.h - resize.w;
                            resize.w -= diffVal;
                            resize.h -= diffVal;
                        }
                        return false;
                    }

                    if(this.defaults.height) {
                        if(resize.w > resize.h) {
                            diffVal = resize.w - resize.h;
                            resize.w -= diffVal;
                            resize.h -= diffVal;
                        }
                        else if (resize.w < resize.h) {
                            diffVal = resize.h - resize.w;
                            resize.w += diffVal;
                            resize.h += diffVal;
                        }
                        return false;
                    }
                    break;

                default:
                    // do nothing
            }
        }
      };

      // 暴露接口
      window.lrz = function(file, options, callback) {
        return new Lrz(file, options, callback);
      };
    })();
