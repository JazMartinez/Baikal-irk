;(function (window, $) {
    "use strict";
    $.SliderPro = {
        modules: [], addModule: function (name, module) {
            this.modules.push(name);
            $.extend(SliderPro.prototype, module)
        }
    };
    var NS = $.SliderPro.namespace = 'SliderPro';
    var SliderPro = function (instance, options) {
        this.instance = instance;
        this.$slider = $(this.instance);
        this.$slides = null;
        this.$slidesMask = null;
        this.$slidesContainer = null;
        this.slides = [];
        this.slidesOrder = [];
        this.options = options;
        this.settings = {};
        this.originalSettings = {};
        this.originalGotoSlide = null;
        this.selectedSlideIndex = 0;
        this.previousSlideIndex = 0;
        this.middleSlidePosition = 0;
        this.supportedAnimation = null;
        this.vendorPrefix = null;
        this.transitionEvent = null;
        this.positionProperty = null;
        this.isIE = null;
        this.slidesPosition = 0;
        this.slideWidth = 0;
        this.slideHeight = 0;
        this.slideSize = 0;
        this.previousSlideWidth = 0;
        this.previousSlideHeight = 0;
        this.previousWindowWidth = 0;
        this.previousWindowHeight = 0;
        this.visibleOffset = 0;
        this.allowResize = true;
        this.uniqueId = new Date().valueOf();
        this.breakpoints = [];
        this.currentBreakpoint = -1;
        this.shuffledIndexes = [];
        this._init()
    };
    SliderPro.prototype = {
        _init: function () {
            var that = this;
            this.supportedAnimation = SliderProUtils.getSupportedAnimation();
            this.vendorPrefix = SliderProUtils.getVendorPrefix();
            this.transitionEvent = SliderProUtils.getTransitionEvent();
            this.isIE = SliderProUtils.checkIE();
            this.$slider.removeClass('sp-no-js');
            if (window.navigator.userAgent.match(/(iPad|iPhone|iPod)/g)) {
                this.$slider.addClass('ios')
            }
            var rmsie = /(msie) ([\w.]+)/, ieVersion = rmsie.exec(window.navigator.userAgent.toLowerCase());
            if (this.isIE) {
                this.$slider.addClass('ie')
            }
            if (ieVersion !== null) {
                this.$slider.addClass('ie' + parseInt(ieVersion[2], 10))
            }
            this.$slidesContainer = $('<div class="sp-slides-container"></div>').appendTo(this.$slider);
            this.$slidesMask = $('<div class="sp-mask"></div>').appendTo(this.$slidesContainer);
            this.$slides = this.$slider.find('.sp-slides').appendTo(this.$slidesMask);
            this.$slider.find('.sp-slide').appendTo(this.$slides);
            var modules = $.SliderPro.modules;
            if (typeof modules !== 'undefined') {
                for (var i = 0; i < modules.length; i++) {
                    var defaults = modules[i].substring(0, 1).toLowerCase() + modules[i].substring(1) + 'Defaults';
                    if (typeof this[defaults] !== 'undefined') {
                        $.extend(this.defaults, this[defaults])
                    }
                }
            }
            this.settings = $.extend({}, this.defaults, this.options);
            if (typeof modules !== 'undefined') {
                for (var j = 0; j < modules.length; j++) {
                    if (typeof this['init' + modules[j]] !== 'undefined') {
                        this['init' + modules[j]]()
                    }
                }
            }
            this.originalSettings = $.extend({}, this.settings);
            this.originalGotoSlide = this.gotoSlide;
            if (this.settings.breakpoints !== null) {
                for (var sizes in this.settings.breakpoints) {
                    this.breakpoints.push({size: parseInt(sizes, 10), properties: this.settings.breakpoints[sizes]})
                }
                this.breakpoints = this.breakpoints.sort(function (a, b) {
                    return a.size >= b.size ? 1 : -1
                })
            }
            this.selectedSlideIndex = this.settings.startSlide;
            if (this.settings.shuffle === true) {
                var slides = this.$slides.find('.sp-slide'), shuffledSlides = [];
                slides.each(function (index) {
                    that.shuffledIndexes.push(index)
                });
                for (var k = this.shuffledIndexes.length - 1; k > 0; k--) {
                    var l = Math.floor(Math.random() * (k + 1)), temp = this.shuffledIndexes[k];
                    this.shuffledIndexes[k] = this.shuffledIndexes[l];
                    this.shuffledIndexes[l] = temp
                }
                $.each(this.shuffledIndexes, function (index, element) {
                    shuffledSlides.push(slides[element])
                });
                this.$slides.empty().append(shuffledSlides)
            }
            $(window).on('resize.' + this.uniqueId + '.' + NS, function () {
                var newWindowWidth = $(window).width(), newWindowHeight = $(window).height();
                if (that.allowResize === false || (that.previousWindowWidth === newWindowWidth && that.previousWindowHeight === newWindowHeight)) {
                    return
                }
                that.previousWindowWidth = newWindowWidth;
                that.previousWindowHeight = newWindowHeight;
                that.allowResize = false;
                setTimeout(function () {
                    that.resize();
                    that.allowResize = true
                }, 200)
            });
            this.on('update.' + NS, function () {
                that.previousSlideWidth = 0;
                that.resize()
            });
            this.update();
            this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).addClass('sp-selected');
            this.trigger({type: 'init'});
            if ($.isFunction(this.settings.init)) {
                this.settings.init.call(this, {type: 'init'})
            }
        },
        update: function () {
            var that = this;
            if (this.settings.orientation === 'horizontal') {
                this.$slider.removeClass('sp-vertical').addClass('sp-horizontal');
                this.$slider.css({'height': '', 'max-height': ''});
                this.$slides.find('.sp-slide').css('top', '')
            } else if (this.settings.orientation === 'vertical') {
                this.$slider.removeClass('sp-horizontal').addClass('sp-vertical');
                this.$slides.find('.sp-slide').css('left', '')
            }
            this.positionProperty = this.settings.orientation === 'horizontal' ? 'left' : 'top';
            this.gotoSlide = this.originalGotoSlide;
            for (var i = this.slides.length - 1; i >= 0; i--) {
                if (this.$slider.find('.sp-slide[data-index="' + i + '"]').length === 0) {
                    var slide = this.slides[i];
                    slide.destroy();
                    this.slides.splice(i, 1)
                }
            }
            this.slidesOrder.length = 0;
            this.$slider.find('.sp-slide').each(function (index) {
                var $slide = $(this);
                if (typeof $slide.attr('data-init') === 'undefined') {
                    that._createSlide(index, $slide)
                } else {
                    that.slides[index].setIndex(index)
                }
                that.slidesOrder.push(index)
            });
            this.middleSlidePosition = parseInt((that.slidesOrder.length - 1) / 2, 10);
            if (this.settings.loop === true) {
                this._updateSlidesOrder()
            }
            this.trigger({type: 'update'});
            if ($.isFunction(this.settings.update)) {
                this.settings.update.call(this, {type: 'update'})
            }
        },
        _createSlide: function (index, element) {
            var that = this, slide = new SliderProSlide($(element), index, this.settings);
            this.slides.splice(index, 0, slide)
        },
        _updateSlidesOrder: function () {
            var slicedItems, i, distance = $.inArray(this.selectedSlideIndex, this.slidesOrder) - this.middleSlidePosition;
            if (distance < 0) {
                slicedItems = this.slidesOrder.splice(distance, Math.abs(distance));
                for (i = slicedItems.length - 1; i >= 0; i--) {
                    this.slidesOrder.unshift(slicedItems[i])
                }
            } else if (distance > 0) {
                slicedItems = this.slidesOrder.splice(0, distance);
                for (i = 0; i <= slicedItems.length - 1; i++) {
                    this.slidesOrder.push(slicedItems[i])
                }
            }
        },
        _updateSlidesPosition: function () {
            var selectedSlidePixelPosition = parseInt(this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).css(this.positionProperty), 10);
            for (var slideIndex = 0; slideIndex < this.slidesOrder.length; slideIndex++) {
                var slide = this.$slides.find('.sp-slide').eq(this.slidesOrder[slideIndex]);
                slide.css(this.positionProperty, selectedSlidePixelPosition + (slideIndex - this.middleSlidePosition) * (this.slideSize + this.settings.slideDistance))
            }
        },
        _resetSlidesPosition: function () {
            for (var slideIndex = 0; slideIndex < this.slidesOrder.length; slideIndex++) {
                var slide = this.$slides.find('.sp-slide').eq(this.slidesOrder[slideIndex]);
                slide.css(this.positionProperty, slideIndex * (this.slideSize + this.settings.slideDistance))
            }
            var newSlidesPosition = -parseInt(this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).css(this.positionProperty), 10) + this.visibleOffset;
            this._moveTo(newSlidesPosition, true)
        },
        resize: function () {
            var that = this;
            if (this.settings.breakpoints !== null && this.breakpoints.length > 0) {
                if ($(window).width() > this.breakpoints[this.breakpoints.length - 1].size && this.currentBreakpoint !== -1) {
                    this.currentBreakpoint = -1;
                    this._setProperties(this.originalSettings, false)
                } else {
                    for (var i = 0, n = this.breakpoints.length; i < n; i++) {
                        if ($(window).width() <= this.breakpoints[i].size) {
                            if (this.currentBreakpoint !== this.breakpoints[i].size) {
                                var eventObject = {
                                    type: 'breakpointReach',
                                    size: this.breakpoints[i].size,
                                    settings: this.breakpoints[i].properties
                                };
                                this.trigger(eventObject);
                                if ($.isFunction(this.settings.breakpointReach))this.settings.breakpointReach.call(this, eventObject);
                                this.currentBreakpoint = this.breakpoints[i].size;
                                var settings = $.extend({}, this.originalSettings, this.breakpoints[i].properties);
                                this._setProperties(settings, false);
                                return
                            }
                            break
                        }
                    }
                }
            }
            if (this.settings.responsive === true) {
                if ((this.settings.forceSize === 'fullWidth' || this.settings.forceSize === 'fullWindow') && (this.settings.visibleSize === 'auto' || this.settings.visibleSize !== 'auto' && this.settings.orientation === 'vertical')) {
                    this.$slider.css('margin', 0);
                    this.$slider.css({
                        'width': $(window).width(),
                        'max-width': '',
                        'marginLeft': -this.$slider.offset().left
                    })
                } else {
                    this.$slider.css({'width': '100%', 'max-width': this.settings.width, 'marginLeft': ''})
                }
            } else {
                this.$slider.css({'width': this.settings.width})
            }
            if (this.settings.aspectRatio === -1) {
                this.settings.aspectRatio = this.settings.width / this.settings.height
            }
            this.slideWidth = this.$slider.width();
            if (this.settings.forceSize === 'fullWindow') {
                this.slideHeight = $(window).height()
            } else {
                this.slideHeight = isNaN(this.settings.aspectRatio) ? this.settings.height : this.slideWidth / this.settings.aspectRatio
            }
            if (this.previousSlideWidth !== this.slideWidth || this.previousSlideHeight !== this.slideHeight || this.settings.visibleSize !== 'auto' || this.$slider.outerWidth() > this.$slider.parent().width() || this.$slider.width() !== this.$slidesMask.width()) {
                this.previousSlideWidth = this.slideWidth;
                this.previousSlideHeight = this.slideHeight
            } else {
                return
            }
            this.slideSize = this.settings.orientation === 'horizontal' ? this.slideWidth : this.slideHeight;
            this.visibleSlidesSize = this.slideSize;
            this.visibleOffset = 0;
            $.each(this.slides, function (index, element) {
                element.setSize(that.slideWidth, that.slideHeight)
            });
            this.$slidesMask.css({'width': this.slideWidth, 'height': this.slideHeight});
            if (this.settings.autoHeight === true) {
                setTimeout(function () {
                    that._resizeHeight()
                }, 1)
            } else {
                this.$slidesMask.css(this.vendorPrefix + 'transition', '')
            }
            if (this.settings.visibleSize !== 'auto') {
                if (this.settings.orientation === 'horizontal') {
                    if (this.settings.forceSize === 'fullWidth' || this.settings.forceSize === 'fullWindow') {
                        this.$slider.css('margin', 0);
                        this.$slider.css({
                            'width': $(window).width(),
                            'max-width': '',
                            'marginLeft': -this.$slider.offset().left
                        })
                    } else {
                        this.$slider.css({'width': this.settings.visibleSize, 'max-width': '100%', 'marginLeft': 0})
                    }
                    this.$slidesMask.css('width', this.$slider.width());
                    this.visibleSlidesSize = this.$slidesMask.width();
                    this.visibleOffset = Math.round((this.$slider.width() - this.slideWidth) / 2)
                } else {
                    if (this.settings.forceSize === 'fullWindow') {
                        this.$slider.css({'height': $(window).height(), 'max-height': ''})
                    } else {
                        this.$slider.css({'height': this.settings.visibleSize, 'max-height': '100%'})
                    }
                    this.$slidesMask.css('height', this.$slider.height());
                    this.visibleSlidesSize = this.$slidesMask.height();
                    this.visibleOffset = Math.round((this.$slider.height() - this.slideHeight) / 2)
                }
            }
            this._resetSlidesPosition();
            this.trigger({type: 'sliderResize'});
            if ($.isFunction(this.settings.sliderResize)) {
                this.settings.sliderResize.call(this, {type: 'sliderResize'})
            }
        },
        _resizeHeight: function () {
            var that = this, selectedSlide = this.getSlideAt(this.selectedSlideIndex), size = selectedSlide.getSize();
            selectedSlide.off('imagesLoaded.' + NS);
            selectedSlide.on('imagesLoaded.' + NS, function (event) {
                if (event.index === that.selectedSlideIndex) {
                    var size = selectedSlide.getSize();
                    that._resizeHeightTo(size.height)
                }
            });
            if (size !== 'loading') {
                this._resizeHeightTo(size.height)
            }
        },
        gotoSlide: function (index) {
            if (index === this.selectedSlideIndex || typeof this.slides[index] === 'undefined') {
                return
            }
            var that = this;
            this.previousSlideIndex = this.selectedSlideIndex;
            this.selectedSlideIndex = index;
            this.$slides.find('.sp-selected').removeClass('sp-selected');
            this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).addClass('sp-selected');
            if (this.settings.loop === true) {
                this._updateSlidesOrder();
                this._updateSlidesPosition()
            }
            if (this.settings.autoHeight === true) {
                this._resizeHeight()
            }
            var newSlidesPosition = -parseInt(this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).css(this.positionProperty), 10) + this.visibleOffset;
            this._moveTo(newSlidesPosition, false, function () {
                if (that.settings.loop === true) {
                    that._resetSlidesPosition()
                }
                that.trigger({type: 'gotoSlideComplete', index: index, previousIndex: that.previousSlideIndex});
                if ($.isFunction(that.settings.gotoSlideComplete)) {
                    that.settings.gotoSlideComplete.call(that, {
                        type: 'gotoSlideComplete',
                        index: index,
                        previousIndex: that.previousSlideIndex
                    })
                }
            });
            this.trigger({type: 'gotoSlide', index: index, previousIndex: this.previousSlideIndex});
            if ($.isFunction(this.settings.gotoSlide)) {
                this.settings.gotoSlide.call(this, {
                    type: 'gotoSlide',
                    index: index,
                    previousIndex: this.previousSlideIndex
                })
            }
        },
        nextSlide: function () {
            var index = (this.selectedSlideIndex >= this.getTotalSlides() - 1) ? 0 : (this.selectedSlideIndex + 1);
            this.gotoSlide(index)
        },
        previousSlide: function () {
            var index = this.selectedSlideIndex <= 0 ? (this.getTotalSlides() - 1) : (this.selectedSlideIndex - 1);
            this.gotoSlide(index)
        },
        _moveTo: function (position, instant, callback) {
            var that = this, css = {};
            if (position === this.slidesPosition) {
                return
            }
            this.slidesPosition = position;
            if ((this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') && this.isIE === false) {
                var transition, left = this.settings.orientation === 'horizontal' ? position : 0, top = this.settings.orientation === 'horizontal' ? 0 : position;
                if (this.supportedAnimation === 'css-3d') {
                    css[this.vendorPrefix + 'transform'] = 'translate3d(' + left + 'px, ' + top + 'px, 0)'
                } else {
                    css[this.vendorPrefix + 'transform'] = 'translate(' + left + 'px, ' + top + 'px)'
                }
                if (typeof instant !== 'undefined' && instant === true) {
                    transition = ''
                } else {
                    this.$slides.addClass('sp-animated');
                    transition = this.vendorPrefix + 'transform ' + this.settings.slideAnimationDuration / 1000 + 's';
                    this.$slides.on(this.transitionEvent, function (event) {
                        if (event.target !== event.currentTarget) {
                            return
                        }
                        that.$slides.off(that.transitionEvent);
                        that.$slides.removeClass('sp-animated');
                        if (typeof callback === 'function') {
                            callback()
                        }
                    })
                }
                css[this.vendorPrefix + 'transition'] = transition;
                this.$slides.css(css)
            } else {
                css['margin-' + this.positionProperty] = position;
                if (typeof instant !== 'undefined' && instant === true) {
                    this.$slides.css(css)
                } else {
                    this.$slides.addClass('sp-animated');
                    this.$slides.animate(css, this.settings.slideAnimationDuration, function () {
                        that.$slides.removeClass('sp-animated');
                        if (typeof callback === 'function') {
                            callback()
                        }
                    })
                }
            }
        },
        _stopMovement: function () {
            var css = {};
            if ((this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') && this.isIE === false) {
                var matrixString = this.$slides.css(this.vendorPrefix + 'transform'), matrixType = matrixString.indexOf('matrix3d') !== -1 ? 'matrix3d' : 'matrix', matrixArray = matrixString.replace(matrixType, '').match(/-?[0-9\.]+/g), left = matrixType === 'matrix3d' ? parseInt(matrixArray[12], 10) : parseInt(matrixArray[4], 10), top = matrixType === 'matrix3d' ? parseInt(matrixArray[13], 10) : parseInt(matrixArray[5], 10);
                if (this.supportedAnimation === 'css-3d') {
                    css[this.vendorPrefix + 'transform'] = 'translate3d(' + left + 'px, ' + top + 'px, 0)'
                } else {
                    css[this.vendorPrefix + 'transform'] = 'translate(' + left + 'px, ' + top + 'px)'
                }
                css[this.vendorPrefix + 'transition'] = '';
                this.$slides.css(css);
                this.$slides.off(this.transitionEvent);
                this.slidesPosition = this.settings.orientation === 'horizontal' ? left : top
            } else {
                this.$slides.stop();
                this.slidesPosition = parseInt(this.$slides.css('margin-' + this.positionProperty), 10)
            }
            this.$slides.removeClass('sp-animated')
        },
        _resizeHeightTo: function (height) {
            var that = this, css = {'height': height};
            if (this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') {
                css[this.vendorPrefix + 'transition'] = 'height ' + this.settings.heightAnimationDuration / 1000 + 's';
                this.$slidesMask.off(this.transitionEvent);
                this.$slidesMask.on(this.transitionEvent, function (event) {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    that.$slidesMask.off(that.transitionEvent);
                    that.trigger({type: 'resizeHeightComplete'});
                    if ($.isFunction(that.settings.resizeHeightComplete)) {
                        that.settings.resizeHeightComplete.call(that, {type: 'resizeHeightComplete'})
                    }
                });
                this.$slidesMask.css(css)
            } else {
                this.$slidesMask.stop().animate(css, this.settings.heightAnimationDuration, function (event) {
                    that.trigger({type: 'resizeHeightComplete'});
                    if ($.isFunction(that.settings.resizeHeightComplete)) {
                        that.settings.resizeHeightComplete.call(that, {type: 'resizeHeightComplete'})
                    }
                })
            }
        },
        destroy: function () {
            this.$slider.removeData('sliderPro');
            this.$slider.removeAttr('style');
            this.$slides.removeAttr('style');
            this.off('update.' + NS);
            $(window).off('resize.' + this.uniqueId + '.' + NS);
            var modules = $.SliderPro.modules;
            if (typeof modules !== 'undefined') {
                for (var i = 0; i < modules.length; i++) {
                    if (typeof this['destroy' + modules[i]] !== 'undefined') {
                        this['destroy' + modules[i]]()
                    }
                }
            }
            $.each(this.slides, function (index, element) {
                element.destroy()
            });
            this.slides.length = 0;
            this.$slides.prependTo(this.$slider);
            this.$slidesContainer.remove()
        },
        _setProperties: function (properties, store) {
            for (var prop in properties) {
                this.settings[prop] = properties[prop];
                if (store !== false) {
                    this.originalSettings[prop] = properties[prop]
                }
            }
            this.update()
        },
        on: function (type, callback) {
            return this.$slider.on(type, callback)
        },
        off: function (type) {
            return this.$slider.off(type)
        },
        trigger: function (data) {
            return this.$slider.triggerHandler(data)
        },
        getSlideAt: function (index) {
            return this.slides[index]
        },
        getSelectedSlide: function () {
            return this.selectedSlideIndex
        },
        getTotalSlides: function () {
            return this.slides.length
        },
        defaults: {
            width: 500,
            height: 300,
            responsive: true,
            aspectRatio: -1,
            imageScaleMode: 'cover',
            centerImage: true,
            allowScaleUp: true,
            autoHeight: false,
            startSlide: 0,
            shuffle: false,
            orientation: 'horizontal',
            forceSize: 'none',
            loop: true,
            slideDistance: 10,
            slideAnimationDuration: 700,
            heightAnimationDuration: 700,
            visibleSize: 'auto',
            breakpoints: null,
            init: function () {
            },
            update: function () {
            },
            sliderResize: function () {
            },
            gotoSlide: function () {
            },
            gotoSlideComplete: function () {
            },
            resizeHeightComplete: function () {
            },
            breakpointReach: function () {
            }
        }
    };
    var SliderProSlide = function (slide, index, settings) {
        this.$slide = slide;
        this.$mainImage = null;
        this.$imageContainer = null;
        this.hasMainImage = false;
        this.isMainImageLoaded = false;
        this.isMainImageLoading = false;
        this.hasImages = false;
        this.areImagesLoaded = false;
        this.width = 0;
        this.height = 0;
        this.settings = settings;
        this.setIndex(index);
        this._init()
    };
    SliderProSlide.prototype = {
        _init: function () {
            var that = this;
            this.$slide.attr('data-init', true);
            this.$mainImage = this.$slide.find('.sp-image').length !== 0 ? this.$slide.find('.sp-image') : null;
            if (this.$mainImage !== null) {
                this.hasMainImage = true;
                this.$imageContainer = $('<div class="sp-image-container"></div>').prependTo(this.$slide);
                if (this.$mainImage.parent('a').length !== 0) {
                    this.$mainImage.parent('a').appendTo(this.$imageContainer)
                } else {
                    this.$mainImage.appendTo(this.$imageContainer)
                }
            }
            this.hasImages = this.$slide.find('img').length !== 0 ? true : false
        }, setSize: function (width, height) {
            var that = this;
            this.width = width;
            this.height = this.settings.autoHeight === true ? 'auto' : height;
            this.$slide.css({'width': this.width, 'height': this.height});
            if (this.hasMainImage === true) {
                this.$imageContainer.css({'width': this.width, 'height': this.height});
                if (typeof this.$mainImage.attr('data-src') === 'undefined') {
                    this.resizeMainImage()
                }
            }
        }, getSize: function () {
            var that = this, size;
            if (this.hasImages === true && this.areImagesLoaded === false && typeof this.$slide.attr('data-loading') === 'undefined') {
                this.$slide.attr('data-loading', true);
                var status = SliderProUtils.checkImagesComplete(this.$slide, function () {
                    that.areImagesLoaded = true;
                    that.$slide.removeAttr('data-loading');
                    that.trigger({type: 'imagesLoaded.' + NS, index: that.index})
                });
                if (status === 'complete') {
                    size = this.calculateSize();
                    return {'width': size.width, 'height': size.height}
                } else {
                    return 'loading'
                }
            } else {
                size = this.calculateSize();
                return {'width': size.width, 'height': size.height}
            }
        }, calculateSize: function () {
            var width = this.$slide.width(), height = this.$slide.height();
            this.$slide.children().each(function (index, element) {
                var child = $(element);
                if (child.is(':hidden') === true) {
                    return
                }
                var rect = element.getBoundingClientRect(), bottom = child.position().top + (rect.bottom - rect.top), right = child.position().left + (rect.right - rect.left);
                if (bottom > height) {
                    height = bottom
                }
                if (right > width) {
                    width = right
                }
            });
            return {width: width, height: height}
        }, resizeMainImage: function (isNewImage) {
            var that = this;
            if (isNewImage === true) {
                this.isMainImageLoaded = false;
                this.isMainImageLoading = false
            }
            if (this.isMainImageLoaded === false && this.isMainImageLoading === false) {
                this.isMainImageLoading = true;
                SliderProUtils.checkImagesComplete(this.$mainImage, function () {
                    that.isMainImageLoaded = true;
                    that.isMainImageLoading = false;
                    that.resizeMainImage();
                    that.trigger({type: 'imagesLoaded.' + NS, index: that.index})
                });
                return
            }
            if (this.settings.allowScaleUp === false) {
                this.$mainImage.css({'width': '', 'height': '', 'maxWidth': '', 'maxHeight': ''});
                var naturalWidth = this.$mainImage.width(), naturalHeight = this.$mainImage.height();
                this.$mainImage.css({'maxWidth': naturalWidth, 'maxHeight': naturalHeight})
            }
            if (this.settings.autoHeight === true) {
                this.$mainImage.css({width: '100%', height: 'auto'})
            } else {
                if (this.settings.imageScaleMode === 'cover') {
                    if (this.$mainImage.width() / this.$mainImage.height() <= this.width / this.height) {
                        this.$mainImage.css({width: '100%', height: 'auto'})
                    } else {
                        this.$mainImage.css({width: 'auto', height: '100%'})
                    }
                } else if (this.settings.imageScaleMode === 'contain') {
                    if (this.$mainImage.width() / this.$mainImage.height() >= this.width / this.height) {
                        this.$mainImage.css({width: '100%', height: 'auto'})
                    } else {
                        this.$mainImage.css({width: 'auto', height: '100%'})
                    }
                } else if (this.settings.imageScaleMode === 'exact') {
                    this.$mainImage.css({width: '100%', height: '100%'})
                }
            }
            if (this.settings.centerImage === true) {
                this.$mainImage.css({
                    'marginLeft': (this.$imageContainer.width() - this.$mainImage.width()) * 0.5,
                    'marginTop': (this.$imageContainer.height() - this.$mainImage.height()) * 0.5
                })
            }
        }, destroy: function () {
            this.$slide.removeAttr('style');
            this.$slide.removeAttr('data-init');
            this.$slide.removeAttr('data-index');
            this.$slide.removeAttr('data-loaded');
            if (this.hasMainImage === true) {
                this.$slide.find('.sp-image').removeAttr('style').appendTo(this.$slide);
                this.$slide.find('.sp-image-container').remove()
            }
        }, getIndex: function () {
            return this.index
        }, setIndex: function (index) {
            this.index = index;
            this.$slide.attr('data-index', this.index)
        }, on: function (type, callback) {
            return this.$slide.on(type, callback)
        }, off: function (type) {
            return this.$slide.off(type)
        }, trigger: function (data) {
            return this.$slide.triggerHandler(data)
        }
    };
    window.SliderPro = SliderPro;
    window.SliderProSlide = SliderProSlide;
    $.fn.sliderPro = function (options) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.each(function () {
            if (typeof $(this).data('sliderPro') === 'undefined') {
                var newInstance = new SliderPro(this, options);
                $(this).data('sliderPro', newInstance)
            } else if (typeof options !== 'undefined') {
                var currentInstance = $(this).data('sliderPro');
                if (typeof currentInstance[options] === 'function') {
                    currentInstance[options].apply(currentInstance, args)
                } else if (typeof currentInstance.settings[options] !== 'undefined') {
                    var obj = {};
                    obj[options] = args[0];
                    currentInstance._setProperties(obj)
                } else if (typeof options === 'object') {
                    currentInstance._setProperties(options)
                } else {
                    $.error(options + ' does not exist in sliderPro.')
                }
            }
        })
    };
    var SliderProUtils = {
        supportedAnimation: null,
        vendorPrefix: null,
        transitionEvent: null,
        isIE: null,
        getSupportedAnimation: function () {
            if (this.supportedAnimation !== null) {
                return this.supportedAnimation
            }
            var element = document.body || document.documentElement, elementStyle = element.style, isCSSTransitions = typeof elementStyle.transition !== 'undefined' || typeof elementStyle.WebkitTransition !== 'undefined' || typeof elementStyle.MozTransition !== 'undefined' || typeof elementStyle.OTransition !== 'undefined';
            if (isCSSTransitions === true) {
                var div = document.createElement('div');
                if (typeof div.style.WebkitPerspective !== 'undefined' || typeof div.style.perspective !== 'undefined') {
                    this.supportedAnimation = 'css-3d'
                }
                if (this.supportedAnimation === 'css-3d' && typeof div.styleWebkitPerspective !== 'undefined') {
                    var style = document.createElement('style');
                    style.textContent = '@media (transform-3d),(-webkit-transform-3d){#test-3d{left:9px;position:absolute;height:5px;margin:0;padding:0;border:0;}}';
                    document.getElementsByTagName('head')[0].appendChild(style);
                    div.id = 'test-3d';
                    document.body.appendChild(div);
                    if (!(div.offsetLeft === 9 && div.offsetHeight === 5)) {
                        this.supportedAnimation = null
                    }
                    style.parentNode.removeChild(style);
                    div.parentNode.removeChild(div)
                }
                if (this.supportedAnimation === null && (typeof div.style['-webkit-transform'] !== 'undefined' || typeof div.style.transform !== 'undefined')) {
                    this.supportedAnimation = 'css-2d'
                }
            } else {
                this.supportedAnimation = 'javascript'
            }
            return this.supportedAnimation
        },
        getVendorPrefix: function () {
            if (this.vendorPrefix !== null) {
                return this.vendorPrefix
            }
            var div = document.createElement('div'), prefixes = ['Webkit', 'Moz', 'ms', 'O'];
            if ('transform' in div.style) {
                this.vendorPrefix = '';
                return this.vendorPrefix
            }
            for (var i = 0; i < prefixes.length; i++) {
                if ((prefixes[i] + 'Transform') in div.style) {
                    this.vendorPrefix = '-' + prefixes[i].toLowerCase() + '-';
                    break
                }
            }
            return this.vendorPrefix
        },
        getTransitionEvent: function () {
            if (this.transitionEvent !== null) {
                return this.transitionEvent
            }
            var div = document.createElement('div'), transitions = {
                'transition': 'transitionend',
                'WebkitTransition': 'webkitTransitionEnd',
                'MozTransition': 'transitionend',
                'OTransition': 'oTransitionEnd'
            };
            for (var transition in transitions) {
                if (transition in div.style) {
                    this.transitionEvent = transitions[transition];
                    break
                }
            }
            return this.transitionEvent
        },
        checkImagesComplete: function (target, callback) {
            var that = this, status = this.checkImagesStatus(target);
            if (status === 'loading') {
                var checkImages = setInterval(function () {
                    status = that.checkImagesStatus(target);
                    if (status === 'complete') {
                        clearInterval(checkImages);
                        if (typeof callback === 'function') {
                            callback()
                        }
                    }
                }, 100)
            } else if (typeof callback === 'function') {
                callback()
            }
            return status
        },
        checkImagesStatus: function (target) {
            var status = 'complete';
            if (target.is('img') && target[0].complete === false) {
                status = 'loading'
            } else {
                target.find('img').each(function (index) {
                    var image = $(this)[0];
                    if (image.complete === false) {
                        status = 'loading'
                    }
                })
            }
            return status
        },
        checkIE: function () {
            if (this.isIE !== null) {
                return this.isIE
            }
            var userAgent = window.navigator.userAgent, msie = userAgent.indexOf('MSIE');
            if (userAgent.indexOf('MSIE') !== -1 || userAgent.match(/Trident.*rv\:11\./)) {
                this.isIE = true
            } else {
                this.isIE = false
            }
            return this.isIE
        }
    };
    window.SliderProUtils = SliderProUtils
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Thumbnails.' + $.SliderPro.namespace;
    var Thumbnails = {
        $thumbnails: null,
        $thumbnailsContainer: null,
        thumbnails: null,
        selectedThumbnailIndex: 0,
        thumbnailsSize: 0,
        thumbnailsContainerSize: 0,
        thumbnailsPosition: 0,
        thumbnailsOrientation: null,
        thumbnailsPositionProperty: null,
        isThumbnailScroller: false,
        initThumbnails: function () {
            var that = this;
            this.thumbnails = [];
            this.on('update.' + NS, $.proxy(this._thumbnailsOnUpdate, this));
            this.on('sliderResize.' + NS, $.proxy(this._thumbnailsOnResize, this));
            this.on('gotoSlide.' + NS, function (event) {
                that._gotoThumbnail(event.index)
            })
        },
        _thumbnailsOnUpdate: function () {
            var that = this;
            if (this.$slider.find('.sp-thumbnail').length === 0 && this.thumbnails.length === 0) {
                this.isThumbnailScroller = false;
                return
            }
            this.isThumbnailScroller = true;
            if (this.$thumbnailsContainer === null) {
                this.$thumbnailsContainer = $('<div class="sp-thumbnails-container"></div>').insertAfter(this.$slidesContainer)
            }
            if (this.$thumbnails === null) {
                if (this.$slider.find('.sp-thumbnails').length !== 0) {
                    this.$thumbnails = this.$slider.find('.sp-thumbnails').appendTo(this.$thumbnailsContainer);
                    if (this.settings.shuffle === true) {
                        var thumbnails = this.$thumbnails.find('.sp-thumbnail'), shuffledThumbnails = [];
                        $.each(this.shuffledIndexes, function (index, element) {
                            var $thumbnail = $(thumbnails[element]);
                            if ($thumbnail.parent('a').length !== 0) {
                                $thumbnail = $thumbnail.parent('a')
                            }
                            shuffledThumbnails.push($thumbnail)
                        });
                        this.$thumbnails.empty().append(shuffledThumbnails)
                    }
                } else {
                    this.$thumbnails = $('<div class="sp-thumbnails"></div>').appendTo(this.$thumbnailsContainer)
                }
            }
            this.$slides.find('.sp-thumbnail').each(function (index) {
                var $thumbnail = $(this), thumbnailIndex = $thumbnail.parents('.sp-slide').index(), lastThumbnailIndex = that.$thumbnails.find('.sp-thumbnail').length - 1;
                if ($thumbnail.parent('a').length !== 0) {
                    $thumbnail = $thumbnail.parent('a')
                }
                if (thumbnailIndex > lastThumbnailIndex) {
                    $thumbnail.appendTo(that.$thumbnails)
                } else {
                    $thumbnail.insertBefore(that.$thumbnails.find('.sp-thumbnail').eq(thumbnailIndex))
                }
            });
            for (var i = this.thumbnails.length - 1; i >= 0; i--) {
                if (this.$thumbnails.find('.sp-thumbnail[data-index="' + i + '"]').length === 0) {
                    var thumbnail = this.thumbnails[i];
                    thumbnail.destroy();
                    this.thumbnails.splice(i, 1)
                }
            }
            this.$thumbnails.find('.sp-thumbnail').each(function (index) {
                var $thumbnail = $(this);
                if (typeof $thumbnail.attr('data-init') === 'undefined') {
                    that._createThumbnail($thumbnail, index)
                } else {
                    that.thumbnails[index].setIndex(index)
                }
            });
            this.$thumbnailsContainer.removeClass('sp-top-thumbnails sp-bottom-thumbnails sp-left-thumbnails sp-right-thumbnails');
            if (this.settings.thumbnailsPosition === 'top') {
                this.$thumbnailsContainer.addClass('sp-top-thumbnails');
                this.thumbnailsOrientation = 'horizontal'
            } else if (this.settings.thumbnailsPosition === 'bottom') {
                this.$thumbnailsContainer.addClass('sp-bottom-thumbnails');
                this.thumbnailsOrientation = 'horizontal'
            } else if (this.settings.thumbnailsPosition === 'left') {
                this.$thumbnailsContainer.addClass('sp-left-thumbnails');
                this.thumbnailsOrientation = 'vertical'
            } else if (this.settings.thumbnailsPosition === 'right') {
                this.$thumbnailsContainer.addClass('sp-right-thumbnails');
                this.thumbnailsOrientation = 'vertical'
            }
            if (this.settings.thumbnailPointer === true) {
                this.$thumbnailsContainer.addClass('sp-has-pointer')
            } else {
                this.$thumbnailsContainer.removeClass('sp-has-pointer')
            }
            this.selectedThumbnailIndex = this.selectedSlideIndex;
            this.$thumbnails.find('.sp-thumbnail-container').eq(this.selectedThumbnailIndex).addClass('sp-selected-thumbnail');
            this.thumbnailsSize = 0;
            $.each(this.thumbnails, function (index, thumbnail) {
                thumbnail.setSize(that.settings.thumbnailWidth, that.settings.thumbnailHeight);
                that.thumbnailsSize += that.thumbnailsOrientation === 'horizontal' ? thumbnail.getSize().width : thumbnail.getSize().height
            });
            if (this.thumbnailsOrientation === 'horizontal') {
                this.$thumbnails.css({'width': this.thumbnailsSize, 'height': this.settings.thumbnailHeight});
                this.$thumbnailsContainer.css('height', '');
                this.thumbnailsPositionProperty = 'left'
            } else {
                this.$thumbnails.css({'width': this.settings.thumbnailWidth, 'height': this.thumbnailsSize});
                this.$thumbnailsContainer.css('width', '');
                this.thumbnailsPositionProperty = 'top'
            }
            this.trigger({type: 'thumbnailsUpdate'});
            if ($.isFunction(this.settings.thumbnailsUpdate)) {
                this.settings.thumbnailsUpdate.call(this, {type: 'thumbnailsUpdate'})
            }
        },
        _createThumbnail: function (element, index) {
            var that = this, thumbnail = new Thumbnail(element, this.$thumbnails, index);
            thumbnail.on('thumbnailClick.' + NS, function (event) {
                that.gotoSlide(event.index)
            });
            this.thumbnails.splice(index, 0, thumbnail)
        },
        _thumbnailsOnResize: function () {
            if (this.isThumbnailScroller === false) {
                return
            }
            var that = this, newThumbnailsPosition;
            if (this.thumbnailsOrientation === 'horizontal') {
                this.thumbnailsContainerSize = Math.min(this.$slidesMask.width(), this.thumbnailsSize);
                this.$thumbnailsContainer.css('width', this.thumbnailsContainerSize);
                if (this.settings.forceSize === 'fullWindow') {
                    this.$slidesMask.css('height', this.$slidesMask.height() - this.$thumbnailsContainer.outerHeight(true));
                    this.slideHeight = this.$slidesMask.height();
                    $.each(this.slides, function (index, element) {
                        element.setSize(that.slideWidth, that.slideHeight)
                    })
                }
            } else if (this.thumbnailsOrientation === 'vertical') {
                if (this.$slidesMask.width() + this.$thumbnailsContainer.outerWidth(true) > this.$slider.parent().width()) {
                    if (this.settings.forceSize === 'fullWidth' || this.settings.forceSize === 'fullWindow') {
                        this.$slider.css('max-width', $(window).width() - this.$thumbnailsContainer.outerWidth(true))
                    } else {
                        this.$slider.css('max-width', this.$slider.parent().width() - this.$thumbnailsContainer.outerWidth(true))
                    }
                    this.$slidesMask.css('width', this.$slider.width());
                    if (this.settings.orientation === 'horizontal') {
                        this.visibleOffset = Math.round((this.$slider.width() - this.slideSize) / 2);
                        this.visibleSlidesSize = this.$slidesMask.width()
                    } else if (this.settings.orientation === 'vertical') {
                        this.slideWidth = this.$slider.width();
                        $.each(this.slides, function (index, element) {
                            element.setSize(that.slideWidth, that.slideHeight)
                        })
                    }
                    this._resetSlidesPosition()
                }
                this.thumbnailsContainerSize = Math.min(this.$slidesMask.height(), this.thumbnailsSize);
                this.$thumbnailsContainer.css('height', this.thumbnailsContainerSize)
            }
            if (this.thumbnailsSize <= this.thumbnailsContainerSize || this.$thumbnails.find('.sp-selected-thumbnail').length === 0) {
                newThumbnailsPosition = 0
            } else {
                newThumbnailsPosition = Math.max(-this.thumbnails[this.selectedThumbnailIndex].getPosition()[this.thumbnailsPositionProperty], this.thumbnailsContainerSize - this.thumbnailsSize)
            }
            if (this.settings.thumbnailsPosition === 'top') {
                this.$slider.css({
                    'paddingTop': this.$thumbnailsContainer.outerHeight(true),
                    'paddingLeft': '',
                    'paddingRight': ''
                })
            } else if (this.settings.thumbnailsPosition === 'bottom') {
                this.$slider.css({'paddingTop': '', 'paddingLeft': '', 'paddingRight': ''})
            } else if (this.settings.thumbnailsPosition === 'left') {
                this.$slider.css({
                    'paddingTop': '',
                    'paddingLeft': this.$thumbnailsContainer.outerWidth(true),
                    'paddingRight': ''
                })
            } else if (this.settings.thumbnailsPosition === 'right') {
                this.$slider.css({
                    'paddingTop': '',
                    'paddingLeft': '',
                    'paddingRight': this.$thumbnailsContainer.outerWidth(true)
                })
            }
            this._moveThumbnailsTo(newThumbnailsPosition, true)
        },
        _gotoThumbnail: function (index) {
            if (this.isThumbnailScroller === false || typeof this.thumbnails[index] === 'undefined') {
                return
            }
            var previousIndex = this.selectedThumbnailIndex, newThumbnailsPosition = this.thumbnailsPosition;
            this.selectedThumbnailIndex = index;
            this.$thumbnails.find('.sp-selected-thumbnail').removeClass('sp-selected-thumbnail');
            this.$thumbnails.find('.sp-thumbnail-container').eq(this.selectedThumbnailIndex).addClass('sp-selected-thumbnail');
            if (this.selectedThumbnailIndex >= previousIndex) {
                var nextThumbnailIndex = this.selectedThumbnailIndex === this.thumbnails.length - 1 ? this.selectedThumbnailIndex : this.selectedThumbnailIndex + 1, nextThumbnail = this.thumbnails[nextThumbnailIndex], nextThumbnailPosition = this.thumbnailsOrientation === 'horizontal' ? nextThumbnail.getPosition().right : nextThumbnail.getPosition().bottom, thumbnailsRightPosition = -this.thumbnailsPosition + this.thumbnailsContainerSize;
                if (nextThumbnailPosition > thumbnailsRightPosition) {
                    newThumbnailsPosition = this.thumbnailsPosition - (nextThumbnailPosition - thumbnailsRightPosition)
                }
            } else if (this.selectedThumbnailIndex < previousIndex) {
                var previousThumbnailIndex = this.selectedThumbnailIndex === 0 ? this.selectedThumbnailIndex : this.selectedThumbnailIndex - 1, previousThumbnail = this.thumbnails[previousThumbnailIndex], previousThumbnailPosition = this.thumbnailsOrientation === 'horizontal' ? previousThumbnail.getPosition().left : previousThumbnail.getPosition().top;
                if (previousThumbnailPosition < -this.thumbnailsPosition) {
                    newThumbnailsPosition = -previousThumbnailPosition
                }
            }
            this._moveThumbnailsTo(newThumbnailsPosition);
            this.trigger({type: 'gotoThumbnail'});
            if ($.isFunction(this.settings.gotoThumbnail)) {
                this.settings.gotoThumbnail.call(this, {type: 'gotoThumbnail'})
            }
        },
        _moveThumbnailsTo: function (position, instant, callback) {
            var that = this, css = {};
            if (position === this.thumbnailsPosition) {
                return
            }
            this.thumbnailsPosition = position;
            if (this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') {
                var transition, left = this.thumbnailsOrientation === 'horizontal' ? position : 0, top = this.thumbnailsOrientation === 'horizontal' ? 0 : position;
                if (this.supportedAnimation === 'css-3d') {
                    css[this.vendorPrefix + 'transform'] = 'translate3d(' + left + 'px, ' + top + 'px, 0)'
                } else {
                    css[this.vendorPrefix + 'transform'] = 'translate(' + left + 'px, ' + top + 'px)'
                }
                if (typeof instant !== 'undefined' && instant === true) {
                    transition = ''
                } else {
                    this.$thumbnails.addClass('sp-animated');
                    transition = this.vendorPrefix + 'transform ' + 700 / 1000 + 's';
                    this.$thumbnails.on(this.transitionEvent, function (event) {
                        if (event.target !== event.currentTarget) {
                            return
                        }
                        that.$thumbnails.off(that.transitionEvent);
                        that.$thumbnails.removeClass('sp-animated');
                        if (typeof callback === 'function') {
                            callback()
                        }
                        that.trigger({type: 'thumbnailsMoveComplete'});
                        if ($.isFunction(that.settings.thumbnailsMoveComplete)) {
                            that.settings.thumbnailsMoveComplete.call(that, {type: 'thumbnailsMoveComplete'})
                        }
                    })
                }
                css[this.vendorPrefix + 'transition'] = transition;
                this.$thumbnails.css(css)
            } else {
                css['margin-' + this.thumbnailsPositionProperty] = position;
                if (typeof instant !== 'undefined' && instant === true) {
                    this.$thumbnails.css(css)
                } else {
                    this.$thumbnails.addClass('sp-animated').animate(css, 700, function () {
                        that.$thumbnails.removeClass('sp-animated');
                        if (typeof callback === 'function') {
                            callback()
                        }
                        that.trigger({type: 'thumbnailsMoveComplete'});
                        if ($.isFunction(that.settings.thumbnailsMoveComplete)) {
                            that.settings.thumbnailsMoveComplete.call(that, {type: 'thumbnailsMoveComplete'})
                        }
                    })
                }
            }
        },
        _stopThumbnailsMovement: function () {
            var css = {};
            if (this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') {
                var matrixString = this.$thumbnails.css(this.vendorPrefix + 'transform'), matrixType = matrixString.indexOf('matrix3d') !== -1 ? 'matrix3d' : 'matrix', matrixArray = matrixString.replace(matrixType, '').match(/-?[0-9\.]+/g), left = matrixType === 'matrix3d' ? parseInt(matrixArray[12], 10) : parseInt(matrixArray[4], 10), top = matrixType === 'matrix3d' ? parseInt(matrixArray[13], 10) : parseInt(matrixArray[5], 10);
                if (this.supportedAnimation === 'css-3d') {
                    css[this.vendorPrefix + 'transform'] = 'translate3d(' + left + 'px, ' + top + 'px, 0)'
                } else {
                    css[this.vendorPrefix + 'transform'] = 'translate(' + left + 'px, ' + top + 'px)'
                }
                css[this.vendorPrefix + 'transition'] = '';
                this.$thumbnails.css(css);
                this.$thumbnails.off(this.transitionEvent);
                this.thumbnailsPosition = this.thumbnailsOrientation === 'horizontal' ? parseInt(matrixArray[4], 10) : parseInt(matrixArray[5], 10)
            } else {
                this.$thumbnails.stop();
                this.thumbnailsPosition = parseInt(this.$thumbnails.css('margin-' + this.thumbnailsPositionProperty), 10)
            }
            this.$thumbnails.removeClass('sp-animated')
        },
        destroyThumbnails: function () {
            var that = this;
            this.off('update.' + NS);
            if (this.isThumbnailScroller === false) {
                return
            }
            this.off('sliderResize.' + NS);
            this.off('gotoSlide.' + NS);
            $(window).off('resize.' + this.uniqueId + '.' + NS);
            this.$thumbnails.find('.sp-thumbnail').each(function () {
                var $thumbnail = $(this), index = parseInt($thumbnail.attr('data-index'), 10), thumbnail = that.thumbnails[index];
                thumbnail.off('thumbnailClick.' + NS);
                thumbnail.destroy()
            });
            this.thumbnails.length = 0;
            this.$thumbnails.appendTo(this.$slider);
            this.$thumbnailsContainer.remove();
            this.$slider.css({'paddingTop': '', 'paddingLeft': '', 'paddingRight': ''})
        },
        thumbnailsDefaults: {
            thumbnailWidth: 100,
            thumbnailHeight: 80,
            thumbnailsPosition: 'bottom',
            thumbnailPointer: false,
            thumbnailsUpdate: function () {
            },
            gotoThumbnail: function () {
            },
            thumbnailsMoveComplete: function () {
            }
        }
    };
    var Thumbnail = function (thumbnail, thumbnails, index) {
        this.$thumbnail = thumbnail;
        this.$thumbnails = thumbnails;
        this.$thumbnailContainer = null;
        this.width = 0;
        this.height = 0;
        this.isImageLoaded = false;
        this.setIndex(index);
        this._init()
    };
    Thumbnail.prototype = {
        _init: function () {
            var that = this;
            this.$thumbnail.attr('data-init', true);
            this.$thumbnailContainer = $('<div class="sp-thumbnail-container"></div>').appendTo(this.$thumbnails);
            if (this.$thumbnail.parent('a').length !== 0) {
                this.$thumbnail.parent('a').appendTo(this.$thumbnailContainer)
            } else {
                this.$thumbnail.appendTo(this.$thumbnailContainer)
            }
            this.$thumbnailContainer.on('click.' + NS, function () {
                that.trigger({type: 'thumbnailClick.' + NS, index: that.index})
            })
        }, setSize: function (width, height) {
            this.width = width;
            this.height = height;
            this.$thumbnailContainer.css({'width': this.width, 'height': this.height});
            if (this.$thumbnail.is('img') && typeof this.$thumbnail.attr('data-src') === 'undefined') {
                this.resizeImage()
            }
        }, getSize: function () {
            return {
                width: this.$thumbnailContainer.outerWidth(true),
                height: this.$thumbnailContainer.outerHeight(true)
            }
        }, getPosition: function () {
            return {
                left: this.$thumbnailContainer.position().left + parseInt(this.$thumbnailContainer.css('marginLeft'), 10),
                right: this.$thumbnailContainer.position().left + parseInt(this.$thumbnailContainer.css('marginLeft'), 10) + this.$thumbnailContainer.outerWidth(),
                top: this.$thumbnailContainer.position().top + parseInt(this.$thumbnailContainer.css('marginTop'), 10),
                bottom: this.$thumbnailContainer.position().top + parseInt(this.$thumbnailContainer.css('marginTop'), 10) + this.$thumbnailContainer.outerHeight()
            }
        }, setIndex: function (index) {
            this.index = index;
            this.$thumbnail.attr('data-index', this.index)
        }, resizeImage: function () {
            var that = this;
            if (this.isImageLoaded === false) {
                SliderProUtils.checkImagesComplete(this.$thumbnailContainer, function () {
                    that.isImageLoaded = true;
                    that.resizeImage()
                });
                return
            }
            this.$thumbnail = this.$thumbnailContainer.find('.sp-thumbnail');
            var imageWidth = this.$thumbnail.width(), imageHeight = this.$thumbnail.height();
            if (imageWidth / imageHeight <= this.width / this.height) {
                this.$thumbnail.css({width: '100%', height: 'auto'})
            } else {
                this.$thumbnail.css({width: 'auto', height: '100%'})
            }
            this.$thumbnail.css({
                'marginLeft': (this.$thumbnailContainer.width() - this.$thumbnail.width()) * 0.5,
                'marginTop': (this.$thumbnailContainer.height() - this.$thumbnail.height()) * 0.5
            })
        }, destroy: function () {
            this.$thumbnailContainer.off('click.' + NS);
            this.$thumbnail.removeAttr('data-init');
            this.$thumbnail.removeAttr('data-index');
            if (this.$thumbnail.parent('a').length !== 0) {
                this.$thumbnail.parent('a').insertBefore(this.$thumbnailContainer)
            } else {
                this.$thumbnail.insertBefore(this.$thumbnailContainer)
            }
            this.$thumbnailContainer.remove()
        }, on: function (type, callback) {
            return this.$thumbnailContainer.on(type, callback)
        }, off: function (type) {
            return this.$thumbnailContainer.off(type)
        }, trigger: function (data) {
            return this.$thumbnailContainer.triggerHandler(data)
        }
    };
    $.SliderPro.addModule('Thumbnails', Thumbnails)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'ConditionalImages.' + $.SliderPro.namespace;
    var ConditionalImages = {
        previousImageSize: null,
        currentImageSize: null,
        isRetinaScreen: false,
        initConditionalImages: function () {
            this.currentImageSize = this.previousImageSize = 'default';
            this.isRetinaScreen = (typeof this._isRetina !== 'undefined') && (this._isRetina() === true);
            this.on('update.' + NS, $.proxy(this._conditionalImagesOnUpdate, this));
            this.on('sliderResize.' + NS, $.proxy(this._conditionalImagesOnResize, this))
        },
        _conditionalImagesOnUpdate: function () {
            $.each(this.slides, function (index, element) {
                var $slide = element.$slide;
                $slide.find('img:not([ data-default ])').each(function () {
                    var $image = $(this);
                    if (typeof $image.attr('data-src') !== 'undefined') {
                        $image.attr('data-default', $image.attr('data-src'))
                    } else {
                        $image.attr('data-default', $image.attr('src'))
                    }
                })
            })
        },
        _conditionalImagesOnResize: function () {
            if (this.slideWidth <= this.settings.smallSize) {
                this.currentImageSize = 'small'
            } else if (this.slideWidth <= this.settings.mediumSize) {
                this.currentImageSize = 'medium'
            } else if (this.slideWidth <= this.settings.largeSize) {
                this.currentImageSize = 'large'
            } else {
                this.currentImageSize = 'default'
            }
            if (this.previousImageSize !== this.currentImageSize) {
                var that = this;
                $.each(this.slides, function (index, element) {
                    var $slide = element.$slide;
                    $slide.find('img').each(function () {
                        var $image = $(this), imageSource = '';
                        if (that.isRetinaScreen === true && typeof $image.attr('data-retina' + that.currentImageSize) !== 'undefined') {
                            imageSource = $image.attr('data-retina' + that.currentImageSize);
                            if (typeof $image.attr('data-retina') !== 'undefined' && $image.attr('data-retina') !== imageSource) {
                                $image.attr('data-retina', imageSource)
                            }
                        } else if ((that.isRetinaScreen === false || that.isRetinaScreen === true && typeof $image.attr('data-retina') === 'undefined') && typeof $image.attr('data-' + that.currentImageSize) !== 'undefined') {
                            imageSource = $image.attr('data-' + that.currentImageSize);
                            if (typeof $image.attr('data-src') !== 'undefined' && $image.attr('data-src') !== imageSource) {
                                $image.attr('data-src', imageSource)
                            }
                        }
                        if (imageSource !== '') {
                            if (typeof $image.attr('data-src') === 'undefined' && $image.attr('src') !== imageSource) {
                                that._loadConditionalImage($image, imageSource, function (newImage) {
                                    if (newImage.hasClass('sp-image')) {
                                        element.$mainImage = newImage;
                                        element.resizeMainImage(true)
                                    }
                                })
                            }
                        }
                    })
                });
                this.previousImageSize = this.currentImageSize
            }
        },
        _loadConditionalImage: function (image, source, callback) {
            var newImage = $(new Image());
            newImage.attr('class', image.attr('class'));
            newImage.attr('style', image.attr('style'));
            $.each(image.data(), function (name, value) {
                newImage.attr('data-' + name, value)
            });
            if (typeof image.attr('width') !== 'undefined') {
                newImage.attr('width', image.attr('width'))
            }
            if (typeof image.attr('height') !== 'undefined') {
                newImage.attr('height', image.attr('height'))
            }
            if (typeof image.attr('alt') !== 'undefined') {
                newImage.attr('alt', image.attr('alt'))
            }
            if (typeof image.attr('title') !== 'undefined') {
                newImage.attr('title', image.attr('title'))
            }
            newImage.attr('src', source);
            newImage.insertAfter(image);
            image.remove();
            image = null;
            if (typeof callback === 'function') {
                callback(newImage)
            }
        },
        destroyConditionalImages: function () {
            this.off('update.' + NS);
            this.off('sliderResize.' + NS)
        },
        conditionalImagesDefaults: {smallSize: 480, mediumSize: 768, largeSize: 1024}
    };
    $.SliderPro.addModule('ConditionalImages', ConditionalImages)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Retina.' + $.SliderPro.namespace;
    var Retina = {
        initRetina: function () {
            var that = this;
            if (this._isRetina() === false) {
                return
            }
            this.on('update.' + NS, $.proxy(this._checkRetinaImages, this));
            if (this.$slider.find('.sp-thumbnail').length !== 0) {
                this.on('update.Thumbnails.' + NS, $.proxy(this._checkRetinaThumbnailImages, this))
            }
        }, _isRetina: function () {
            if (window.devicePixelRatio >= 2) {
                return true
            }
            if (window.matchMedia && (window.matchMedia("(-webkit-min-device-pixel-ratio: 2),(min-resolution: 2dppx)").matches)) {
                return true
            }
            return false
        }, _checkRetinaImages: function () {
            var that = this;
            $.each(this.slides, function (index, element) {
                var $slide = element.$slide;
                if (typeof $slide.attr('data-retina-loaded') === 'undefined') {
                    $slide.attr('data-retina-loaded', true);
                    $slide.find('img[data-retina]').each(function () {
                        var $image = $(this);
                        if (typeof $image.attr('data-src') !== 'undefined') {
                            $image.attr('data-src', $image.attr('data-retina'))
                        } else {
                            that._loadRetinaImage($image, function (newImage) {
                                if (newImage.hasClass('sp-image')) {
                                    element.$mainImage = newImage;
                                    element.resizeMainImage(true)
                                }
                            })
                        }
                    })
                }
            })
        }, _checkRetinaThumbnailImages: function () {
            var that = this;
            $.each(this.thumbnails, function (index, element) {
                var $thumbnail = element.$thumbnailContainer;
                if (typeof $thumbnail.attr('data-retina-loaded') === 'undefined') {
                    $thumbnail.attr('data-retina-loaded', true);
                    $thumbnail.find('img[data-retina]').each(function () {
                        var $image = $(this);
                        if (typeof $image.attr('data-src') !== 'undefined') {
                            $image.attr('data-src', $image.attr('data-retina'))
                        } else {
                            that._loadRetinaImage($image, function (newImage) {
                                if (newImage.hasClass('sp-thumbnail')) {
                                    element.resizeImage()
                                }
                            })
                        }
                    })
                }
            })
        }, _loadRetinaImage: function (image, callback) {
            var retinaFound = false, newImagePath = '';
            if (typeof image.attr('data-retina') !== 'undefined') {
                retinaFound = true;
                newImagePath = image.attr('data-retina')
            }
            if (typeof image.attr('data-src') !== 'undefined') {
                if (retinaFound === false) {
                    newImagePath = image.attr('data-src')
                }
                image.removeAttr('data-src')
            }
            if (newImagePath === '') {
                return
            }
            var newImage = $(new Image());
            newImage.attr('class', image.attr('class'));
            newImage.attr('style', image.attr('style'));
            $.each(image.data(), function (name, value) {
                newImage.attr('data-' + name, value)
            });
            if (typeof image.attr('width') !== 'undefined') {
                newImage.attr('width', image.attr('width'))
            }
            if (typeof image.attr('height') !== 'undefined') {
                newImage.attr('height', image.attr('height'))
            }
            if (typeof image.attr('alt') !== 'undefined') {
                newImage.attr('alt', image.attr('alt'))
            }
            if (typeof image.attr('title') !== 'undefined') {
                newImage.attr('title', image.attr('title'))
            }
            newImage.insertAfter(image);
            image.remove();
            image = null;
            newImage.attr('src', newImagePath);
            if (typeof callback === 'function') {
                callback(newImage)
            }
        }, destroyRetina: function () {
            this.off('update.' + NS);
            this.off('update.Thumbnails.' + NS)
        }
    };
    $.SliderPro.addModule('Retina', Retina)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'LazyLoading.' + $.SliderPro.namespace;
    var LazyLoading = {
        allowLazyLoadingCheck: true, initLazyLoading: function () {
            var that = this;
            this.on('sliderResize.' + NS, $.proxy(this._lazyLoadingOnResize, this));
            this.on('gotoSlide.' + NS, $.proxy(this._checkAndLoadVisibleImages, this));
            this.on('thumbnailsUpdate.' + NS + ' ' + 'thumbnailsMoveComplete.' + NS, $.proxy(this._checkAndLoadVisibleThumbnailImages, this))
        }, _lazyLoadingOnResize: function () {
            var that = this;
            if (this.allowLazyLoadingCheck === false) {
                return
            }
            this.allowLazyLoadingCheck = false;
            this._checkAndLoadVisibleImages();
            if (this.$slider.find('.sp-thumbnail').length !== 0) {
                this._checkAndLoadVisibleThumbnailImages()
            }
            setTimeout(function () {
                that.allowLazyLoadingCheck = true
            }, 500)
        }, _checkAndLoadVisibleImages: function () {
            if (this.$slider.find('.sp-slide:not([ data-loaded ])').length === 0) {
                return
            }
            var that = this, referencePosition = this.settings.loop === true ? this.middleSlidePosition : this.selectedSlideIndex, visibleOnSides = Math.ceil((this.visibleSlidesSize - this.slideSize) / 2 / this.slideSize), from = referencePosition - visibleOnSides - 1 > 0 ? referencePosition - visibleOnSides - 1 : 0, to = referencePosition + visibleOnSides + 1 < this.getTotalSlides() - 1 ? referencePosition + visibleOnSides + 1 : this.getTotalSlides() - 1, slidesToCheck = this.slidesOrder.slice(from, to + 1);
            $.each(slidesToCheck, function (index, element) {
                var slide = that.slides[element], $slide = slide.$slide;
                if (typeof $slide.attr('data-loaded') === 'undefined') {
                    $slide.attr('data-loaded', true);
                    $slide.find('img[ data-src ]').each(function () {
                        var image = $(this);
                        that._loadImage(image, function (newImage) {
                            if (newImage.hasClass('sp-image')) {
                                slide.$mainImage = newImage;
                                slide.resizeMainImage(true)
                            }
                        })
                    })
                }
            })
        }, _checkAndLoadVisibleThumbnailImages: function () {
            if (this.$slider.find('.sp-thumbnail-container:not([ data-loaded ])').length === 0) {
                return
            }
            var that = this, thumbnailSize = this.thumbnailsSize / this.thumbnails.length, from = Math.floor(Math.abs(this.thumbnailsPosition / thumbnailSize)), to = Math.floor((-this.thumbnailsPosition + this.thumbnailsContainerSize) / thumbnailSize), thumbnailsToCheck = this.thumbnails.slice(from, to + 1);
            $.each(thumbnailsToCheck, function (index, element) {
                var $thumbnailContainer = element.$thumbnailContainer;
                if (typeof $thumbnailContainer.attr('data-loaded') === 'undefined') {
                    $thumbnailContainer.attr('data-loaded', true);
                    $thumbnailContainer.find('img[ data-src ]').each(function () {
                        var image = $(this);
                        that._loadImage(image, function () {
                            element.resizeImage()
                        })
                    })
                }
            })
        }, _loadImage: function (image, callback) {
            var newImage = $(new Image());
            newImage.attr('class', image.attr('class'));
            newImage.attr('style', image.attr('style'));
            $.each(image.data(), function (name, value) {
                newImage.attr('data-' + name, value)
            });
            if (typeof image.attr('width') !== 'undefined') {
                newImage.attr('width', image.attr('width'))
            }
            if (typeof image.attr('height') !== 'undefined') {
                newImage.attr('height', image.attr('height'))
            }
            if (typeof image.attr('alt') !== 'undefined') {
                newImage.attr('alt', image.attr('alt'))
            }
            if (typeof image.attr('title') !== 'undefined') {
                newImage.attr('title', image.attr('title'))
            }
            newImage.attr('src', image.attr('data-src'));
            newImage.removeAttr('data-src');
            newImage.insertAfter(image);
            image.remove();
            image = null;
            if (typeof callback === 'function') {
                callback(newImage)
            }
        }, destroyLazyLoading: function () {
            this.off('update.' + NS);
            this.off('gotoSlide.' + NS);
            this.off('sliderResize.' + NS);
            this.off('thumbnailsUpdate.' + NS);
            this.off('thumbnailsMoveComplete.' + NS)
        }
    };
    $.SliderPro.addModule('LazyLoading', LazyLoading)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Layers.' + $.SliderPro.namespace;
    var Layers = {
        layersGotoSlideReference: null,
        waitForLayersTimer: null,
        initLayers: function () {
            this.on('update.' + NS, $.proxy(this._layersOnUpdate, this));
            this.on('sliderResize.' + NS, $.proxy(this._layersOnResize, this));
            this.on('gotoSlide.' + NS, $.proxy(this._layersOnGotoSlide, this))
        },
        _layersOnUpdate: function (event) {
            var that = this;
            $.each(this.slides, function (index, element) {
                var $slide = element.$slide;
                this.$slide.find('.sp-layer:not([ data-layer-init ])').each(function () {
                    var layer = new Layer($(this));
                    if (typeof element.layers === 'undefined') {
                        element.layers = []
                    }
                    element.layers.push(layer);
                    if ($(this).hasClass('sp-static') === false) {
                        if (typeof element.animatedLayers === 'undefined') {
                            element.animatedLayers = []
                        }
                        element.animatedLayers.push(layer)
                    }
                })
            });
            if (this.settings.waitForLayers === true) {
                clearTimeout(this.waitForLayersTimer);
                this.waitForLayersTimer = setTimeout(function () {
                    that.layersGotoSlideReference = that.gotoSlide;
                    that.gotoSlide = that._layersGotoSlide
                }, 1)
            }
            setTimeout(function () {
                that.showLayers(that.selectedSlideIndex)
            }, 1)
        },
        _layersOnResize: function () {
            var that = this, autoScaleReference, useAutoScale = this.settings.autoScaleLayers, scaleRatio;
            if (this.settings.autoScaleLayers === false) {
                return
            }
            if (this.settings.autoScaleReference === -1) {
                if (typeof this.settings.width === 'string' && this.settings.width.indexOf('%') !== -1) {
                    useAutoScale = false
                } else {
                    autoScaleReference = parseInt(this.settings.width, 10)
                }
            } else {
                autoScaleReference = this.settings.autoScaleReference
            }
            if (useAutoScale === true && this.slideWidth < autoScaleReference) {
                scaleRatio = that.slideWidth / autoScaleReference
            } else {
                scaleRatio = 1
            }
            $.each(this.slides, function (index, slide) {
                if (typeof slide.layers !== 'undefined') {
                    $.each(slide.layers, function (index, layer) {
                        layer.scale(scaleRatio)
                    })
                }
            })
        },
        _layersGotoSlide: function (index) {
            var that = this, animatedLayers = this.slides[this.selectedSlideIndex].animatedLayers;
            if (this.$slider.hasClass('sp-swiping') || typeof animatedLayers === 'undefined' || animatedLayers.length === 0) {
                this.layersGotoSlideReference(index)
            } else {
                this.on('hideLayersComplete.' + NS, function () {
                    that.off('hideLayersComplete.' + NS);
                    that.layersGotoSlideReference(index)
                });
                this.hideLayers(this.selectedSlideIndex)
            }
        },
        _layersOnGotoSlide: function (event) {
            if (this.previousSlideIndex !== this.selectedSlideIndex && this.settings.waitForLayers === false) {
                this.hideLayers(this.previousSlideIndex)
            }
            this.showLayers(this.selectedSlideIndex)
        },
        showLayers: function (index) {
            var that = this, animatedLayers = this.slides[index].animatedLayers, layerCounter = 0;
            if (typeof animatedLayers === 'undefined') {
                return
            }
            $.each(animatedLayers, function (index, element) {
                if (element.isVisible() === true) {
                    layerCounter++;
                    if (layerCounter === animatedLayers.length) {
                        that.trigger({type: 'showLayersComplete', index: index});
                        if ($.isFunction(that.settings.showLayersComplete)) {
                            that.settings.showLayersComplete.call(that, {type: 'showLayersComplete', index: index})
                        }
                    }
                } else {
                    element.show(function () {
                        layerCounter++;
                        if (layerCounter === animatedLayers.length) {
                            that.trigger({type: 'showLayersComplete', index: index});
                            if ($.isFunction(that.settings.showLayersComplete)) {
                                that.settings.showLayersComplete.call(that, {type: 'showLayersComplete', index: index})
                            }
                        }
                    })
                }
            })
        },
        hideLayers: function (index) {
            var that = this, animatedLayers = this.slides[index].animatedLayers, layerCounter = 0;
            if (typeof animatedLayers === 'undefined') {
                return
            }
            $.each(animatedLayers, function (index, element) {
                if (element.isVisible() === false) {
                    layerCounter++;
                    if (layerCounter === animatedLayers.length) {
                        that.trigger({type: 'hideLayersComplete', index: index});
                        if ($.isFunction(that.settings.hideLayersComplete)) {
                            that.settings.hideLayersComplete.call(that, {type: 'hideLayersComplete', index: index})
                        }
                    }
                } else {
                    element.hide(function () {
                        layerCounter++;
                        if (layerCounter === animatedLayers.length) {
                            that.trigger({type: 'hideLayersComplete', index: index});
                            if ($.isFunction(that.settings.hideLayersComplete)) {
                                that.settings.hideLayersComplete.call(that, {type: 'hideLayersComplete', index: index})
                            }
                        }
                    })
                }
            })
        },
        destroyLayers: function () {
            this.off('update.' + NS);
            this.off('resize.' + NS);
            this.off('gotoSlide.' + NS);
            this.off('hideLayersComplete.' + NS)
        },
        layersDefaults: {
            waitForLayers: false,
            autoScaleLayers: true,
            autoScaleReference: -1,
            showLayersComplete: function () {
            },
            hideLayersComplete: function () {
            }
        }
    };
    var slideDestroy = window.SliderProSlide.prototype.destroy;
    window.SliderProSlide.prototype.destroy = function () {
        if (typeof this.layers !== 'undefined') {
            $.each(this.layers, function (index, element) {
                element.destroy()
            });
            this.layers.length = 0
        }
        if (typeof this.animatedLayers !== 'undefined') {
            this.animatedLayers.length = 0
        }
        slideDestroy.apply(this)
    };
    var Layer = function (layer) {
        this.$layer = layer;
        this.visible = false;
        this.styled = false;
        this.data = null;
        this.position = null;
        this.horizontalProperty = null;
        this.verticalProperty = null;
        this.horizontalPosition = null;
        this.verticalPosition = null;
        this.scaleRatio = 1;
        this.supportedAnimation = SliderProUtils.getSupportedAnimation();
        this.vendorPrefix = SliderProUtils.getVendorPrefix();
        this.transitionEvent = SliderProUtils.getTransitionEvent();
        this.stayTimer = null;
        this._init()
    };
    Layer.prototype = {
        _init: function () {
            this.$layer.attr('data-layer-init', true);
            if (this.$layer.hasClass('sp-static')) {
                this._setStyle()
            } else {
                this.$layer.css({'visibility': 'hidden'})
            }
        }, _setStyle: function () {
            this.styled = true;
            this.data = this.$layer.data();
            if (typeof this.data.width !== 'undefined') {
                this.$layer.css('width', this.data.width)
            }
            if (typeof this.data.height !== 'undefined') {
                this.$layer.css('height', this.data.height)
            }
            if (typeof this.data.depth !== 'undefined') {
                this.$layer.css('z-index', this.data.depth)
            }
            this.position = this.data.position ? (this.data.position).toLowerCase() : 'topleft';
            if (this.position.indexOf('right') !== -1) {
                this.horizontalProperty = 'right'
            } else if (this.position.indexOf('left') !== -1) {
                this.horizontalProperty = 'left'
            } else {
                this.horizontalProperty = 'center'
            }
            if (this.position.indexOf('bottom') !== -1) {
                this.verticalProperty = 'bottom'
            } else if (this.position.indexOf('top') !== -1) {
                this.verticalProperty = 'top'
            } else {
                this.verticalProperty = 'center'
            }
            this._setPosition();
            this.scale(this.scaleRatio)
        }, _setPosition: function () {
            var inlineStyle = this.$layer.attr('style');
            this.horizontalPosition = typeof this.data.horizontal !== 'undefined' ? this.data.horizontal : 0;
            this.verticalPosition = typeof this.data.vertical !== 'undefined' ? this.data.vertical : 0;
            if (this.horizontalProperty === 'center') {
                if (this.$layer.is('img') === false && (typeof inlineStyle === 'undefined' || (typeof inlineStyle !== 'undefined' && inlineStyle.indexOf('width') === -1))) {
                    this.$layer.css('white-space', 'nowrap');
                    this.$layer.css('width', this.$layer.outerWidth(true))
                }
                this.$layer.css({
                    'marginLeft': 'auto',
                    'marginRight': 'auto',
                    'left': this.horizontalPosition,
                    'right': 0
                })
            } else {
                this.$layer.css(this.horizontalProperty, this.horizontalPosition)
            }
            if (this.verticalProperty === 'center') {
                if (this.$layer.is('img') === false && (typeof inlineStyle === 'undefined' || (typeof inlineStyle !== 'undefined' && inlineStyle.indexOf('height') === -1))) {
                    this.$layer.css('white-space', 'nowrap');
                    this.$layer.css('height', this.$layer.outerHeight(true))
                }
                this.$layer.css({
                    'marginTop': 'auto',
                    'marginBottom': 'auto',
                    'top': this.verticalPosition,
                    'bottom': 0
                })
            } else {
                this.$layer.css(this.verticalProperty, this.verticalPosition)
            }
        }, scale: function (ratio) {
            if (this.$layer.hasClass('sp-no-scale')) {
                return
            }
            this.scaleRatio = ratio;
            if (this.styled === false) {
                return
            }
            var horizontalProperty = this.horizontalProperty === 'center' ? 'left' : this.horizontalProperty, verticalProperty = this.verticalProperty === 'center' ? 'top' : this.verticalProperty, css = {};
            css[this.vendorPrefix + 'transform-origin'] = this.horizontalProperty + ' ' + this.verticalProperty;
            css[this.vendorPrefix + 'transform'] = 'scale(' + this.scaleRatio + ')';
            if (typeof this.horizontalPosition !== 'string') {
                css[horizontalProperty] = this.horizontalPosition * this.scaleRatio
            }
            if (typeof this.verticalPosition !== 'string') {
                css[verticalProperty] = this.verticalPosition * this.scaleRatio
            }
            if (typeof this.data.width === 'string' && this.data.width.indexOf('%') !== -1) {
                css.width = (parseInt(this.data.width, 10) / this.scaleRatio).toString() + '%'
            }
            if (typeof this.data.height === 'string' && this.data.height.indexOf('%') !== -1) {
                css.height = (parseInt(this.data.height, 10) / this.scaleRatio).toString() + '%'
            }
            this.$layer.css(css)
        }, show: function (callback) {
            if (this.visible === true) {
                return
            }
            this.visible = true;
            if (this.styled === false) {
                this._setStyle()
            }
            var that = this, offset = typeof this.data.showOffset !== 'undefined' ? this.data.showOffset : 50, duration = typeof this.data.showDuration !== 'undefined' ? this.data.showDuration / 1000 : 0.4, delay = typeof this.data.showDelay !== 'undefined' ? this.data.showDelay : 10, stayDuration = typeof that.data.stayDuration !== 'undefined' ? parseInt(that.data.stayDuration, 10) : -1;
            if (this.supportedAnimation === 'javascript') {
                this.$layer.stop().delay(delay).css({
                    'opacity': 0,
                    'visibility': 'visible'
                }).animate({'opacity': 1}, duration * 1000, function () {
                    if (stayDuration !== -1) {
                        that.stayTimer = setTimeout(function () {
                            that.hide();
                            that.stayTimer = null
                        }, stayDuration)
                    }
                    if (typeof callback !== 'undefined') {
                        callback()
                    }
                })
            } else {
                var start = {'opacity': 0, 'visibility': 'visible'}, target = {'opacity': 1}, transformValues = '';
                start[this.vendorPrefix + 'transform'] = 'scale(' + this.scaleRatio + ')';
                target[this.vendorPrefix + 'transform'] = 'scale(' + this.scaleRatio + ')';
                target[this.vendorPrefix + 'transition'] = 'opacity ' + duration + 's';
                if (typeof this.data.showTransition !== 'undefined') {
                    if (this.data.showTransition === 'left') {
                        transformValues = offset + 'px, 0'
                    } else if (this.data.showTransition === 'right') {
                        transformValues = '-' + offset + 'px, 0'
                    } else if (this.data.showTransition === 'up') {
                        transformValues = '0, ' + offset + 'px'
                    } else if (this.data.showTransition === 'down') {
                        transformValues = '0, -' + offset + 'px'
                    }
                    start[this.vendorPrefix + 'transform'] += this.supportedAnimation === 'css-3d' ? ' translate3d(' + transformValues + ', 0)' : ' translate(' + transformValues + ')';
                    target[this.vendorPrefix + 'transform'] += this.supportedAnimation === 'css-3d' ? ' translate3d(0, 0, 0)' : ' translate(0, 0)';
                    target[this.vendorPrefix + 'transition'] += ', ' + this.vendorPrefix + 'transform ' + duration + 's'
                }
                this.$layer.on(this.transitionEvent, function (event) {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    that.$layer.off(that.transitionEvent).css(that.vendorPrefix + 'transition', '');
                    if (stayDuration !== -1) {
                        that.stayTimer = setTimeout(function () {
                            that.hide();
                            that.stayTimer = null
                        }, stayDuration)
                    }
                    if (typeof callback !== 'undefined') {
                        callback()
                    }
                });
                this.$layer.css(start);
                setTimeout(function () {
                    that.$layer.css(target)
                }, delay)
            }
        }, hide: function (callback) {
            if (this.visible === false) {
                return
            }
            var that = this, offset = typeof this.data.hideOffset !== 'undefined' ? this.data.hideOffset : 50, duration = typeof this.data.hideDuration !== 'undefined' ? this.data.hideDuration / 1000 : 0.4, delay = typeof this.data.hideDelay !== 'undefined' ? this.data.hideDelay : 10;
            this.visible = false;
            if (this.stayTimer !== null) {
                clearTimeout(this.stayTimer)
            }
            if (this.supportedAnimation === 'javascript') {
                this.$layer.stop().delay(delay).animate({'opacity': 0}, duration * 1000, function () {
                    $(this).css('visibility', 'hidden');
                    if (typeof callback !== 'undefined') {
                        callback()
                    }
                })
            } else {
                var transformValues = '', target = {'opacity': 0};
                target[this.vendorPrefix + 'transform'] = 'scale(' + this.scaleRatio + ')';
                target[this.vendorPrefix + 'transition'] = 'opacity ' + duration + 's';
                if (typeof this.data.hideTransition !== 'undefined') {
                    if (this.data.hideTransition === 'left') {
                        transformValues = '-' + offset + 'px, 0'
                    } else if (this.data.hideTransition === 'right') {
                        transformValues = offset + 'px, 0'
                    } else if (this.data.hideTransition === 'up') {
                        transformValues = '0, -' + offset + 'px'
                    } else if (this.data.hideTransition === 'down') {
                        transformValues = '0, ' + offset + 'px'
                    }
                    target[this.vendorPrefix + 'transform'] += this.supportedAnimation === 'css-3d' ? ' translate3d(' + transformValues + ', 0)' : ' translate(' + transformValues + ')';
                    target[this.vendorPrefix + 'transition'] += ', ' + this.vendorPrefix + 'transform ' + duration + 's'
                }
                this.$layer.on(this.transitionEvent, function (event) {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    that.$layer.off(that.transitionEvent).css(that.vendorPrefix + 'transition', '');
                    if (that.visible === false) {
                        that.$layer.css('visibility', 'hidden')
                    }
                    if (typeof callback !== 'undefined') {
                        callback()
                    }
                });
                setTimeout(function () {
                    that.$layer.css(target)
                }, delay)
            }
        }, isVisible: function () {
            if (this.visible === false || this.$layer.is(':hidden')) {
                return false
            }
            return true
        }, destroy: function () {
            this.$layer.removeAttr('style');
            this.$layer.removeAttr('data-layer-init')
        }
    };
    $.SliderPro.addModule('Layers', Layers)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Fade.' + $.SliderPro.namespace;
    var Fade = {
        fadeGotoSlideReference: null, initFade: function () {
            this.on('update.' + NS, $.proxy(this._fadeOnUpdate, this))
        }, _fadeOnUpdate: function () {
            if (this.settings.fade === true) {
                this.fadeGotoSlideReference = this.gotoSlide;
                this.gotoSlide = this._fadeGotoSlide
            }
        }, _fadeGotoSlide: function (index) {
            if (index === this.selectedSlideIndex) {
                return
            }
            if (this.$slider.hasClass('sp-swiping')) {
                this.fadeGotoSlideReference(index)
            } else {
                var that = this, $nextSlide, $previousSlide, newIndex = index;
                $.each(this.slides, function (index, element) {
                    var slideIndex = element.getIndex(), $slide = element.$slide;
                    if (slideIndex === newIndex) {
                        $slide.css({'opacity': 0, 'left': 0, 'top': 0, 'z-index': 20});
                        $nextSlide = $slide
                    } else if (slideIndex === that.selectedSlideIndex) {
                        $slide.css({'opacity': 1, 'left': 0, 'top': 0, 'z-index': 10});
                        $previousSlide = $slide
                    } else {
                        $slide.css('visibility', 'hidden')
                    }
                });
                this.previousSlideIndex = this.selectedSlideIndex;
                this.selectedSlideIndex = index;
                this.$slides.find('.sp-selected').removeClass('sp-selected');
                this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).addClass('sp-selected');
                if (that.settings.loop === true) {
                    that._updateSlidesOrder()
                }
                this._moveTo(this.visibleOffset, true);
                if (this.settings.fadeOutPreviousSlide === true) {
                    this._fadeSlideTo($previousSlide, 0)
                }
                this._fadeSlideTo($nextSlide, 1, function () {
                    $.each(that.slides, function (index, element) {
                        var $slide = element.$slide;
                        $slide.css({'visibility': '', 'opacity': '', 'z-index': ''})
                    });
                    that._resetSlidesPosition();
                    that.trigger({type: 'gotoSlideComplete', index: index, previousIndex: that.previousSlideIndex});
                    if ($.isFunction(that.settings.gotoSlideComplete)) {
                        that.settings.gotoSlideComplete.call(that, {
                            type: 'gotoSlideComplete',
                            index: index,
                            previousIndex: that.previousSlideIndex
                        })
                    }
                });
                if (this.settings.autoHeight === true) {
                    this._resizeHeight()
                }
                this.trigger({type: 'gotoSlide', index: index, previousIndex: this.previousSlideIndex});
                if ($.isFunction(this.settings.gotoSlide)) {
                    this.settings.gotoSlide.call(this, {
                        type: 'gotoSlide',
                        index: index,
                        previousIndex: this.previousSlideIndex
                    })
                }
            }
        }, _fadeSlideTo: function (target, opacity, callback) {
            var that = this;
            if (this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') {
                setTimeout(function () {
                    var css = {'opacity': opacity};
                    css[that.vendorPrefix + 'transition'] = 'opacity ' + that.settings.fadeDuration / 1000 + 's';
                    target.css(css)
                }, 100);
                target.on(this.transitionEvent, function (event) {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    target.off(that.transitionEvent);
                    target.css(that.vendorPrefix + 'transition', '');
                    if (typeof callback === 'function') {
                        callback()
                    }
                })
            } else {
                target.stop().animate({'opacity': opacity}, this.settings.fadeDuration, function () {
                    if (typeof callback === 'function') {
                        callback()
                    }
                })
            }
        }, destroyFade: function () {
            this.off('update.' + NS);
            if (this.fadeGotoSlideReference !== null) {
                this.gotoSlide = this.fadeGotoSlideReference
            }
        }, fadeDefaults: {fade: false, fadeOutPreviousSlide: true, fadeDuration: 500}
    };
    $.SliderPro.addModule('Fade', Fade)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'TouchSwipe.' + $.SliderPro.namespace;
    var TouchSwipe = {
        touchStartPoint: {x: 0, y: 0},
        touchEndPoint: {x: 0, y: 0},
        touchDistance: {x: 0, y: 0},
        touchStartPosition: 0,
        isTouchMoving: false,
        touchSwipeEvents: {startEvent: '', moveEvent: '', endEvent: ''},
        initTouchSwipe: function () {
            var that = this;
            if (this.settings.touchSwipe === false) {
                return
            }
            this.touchSwipeEvents.startEvent = 'touchstart' + '.' + NS + ' mousedown' + '.' + NS;
            this.touchSwipeEvents.moveEvent = 'touchmove' + '.' + NS + ' mousemove' + '.' + NS;
            this.touchSwipeEvents.endEvent = 'touchend' + '.' + this.uniqueId + '.' + NS + ' mouseup' + '.' + this.uniqueId + '.' + NS;
            this.$slidesMask.on(this.touchSwipeEvents.startEvent, $.proxy(this._onTouchStart, this));
            this.$slidesMask.on('dragstart.' + NS, function (event) {
                event.preventDefault()
            });
            this.$slidesMask.addClass('sp-grab')
        },
        _onTouchStart: function (event) {
            if ($(event.target).closest('.sp-selectable').length >= 1) {
                return
            }
            var that = this, eventObject = typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;
            if (typeof event.originalEvent.touches === 'undefined') {
                event.preventDefault()
            }
            $(event.target).parents('.sp-slide').find('a').one('click.' + NS, function (event) {
                event.preventDefault()
            });
            this.touchStartPoint.x = eventObject.pageX || eventObject.clientX;
            this.touchStartPoint.y = eventObject.pageY || eventObject.clientY;
            this.touchStartPosition = this.slidesPosition;
            this.touchDistance.x = this.touchDistance.y = 0;
            if (this.$slides.hasClass('sp-animated')) {
                this.isTouchMoving = true;
                this._stopMovement();
                this.touchStartPosition = this.slidesPosition
            }
            this.$slidesMask.on(this.touchSwipeEvents.moveEvent, $.proxy(this._onTouchMove, this));
            $(document).on(this.touchSwipeEvents.endEvent, $.proxy(this._onTouchEnd, this));
            this.$slidesMask.removeClass('sp-grab').addClass('sp-grabbing');
            this.$slider.addClass('sp-swiping')
        },
        _onTouchMove: function (event) {
            var eventObject = typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;
            this.isTouchMoving = true;
            this.touchEndPoint.x = eventObject.pageX || eventObject.clientX;
            this.touchEndPoint.y = eventObject.pageY || eventObject.clientY;
            this.touchDistance.x = this.touchEndPoint.x - this.touchStartPoint.x;
            this.touchDistance.y = this.touchEndPoint.y - this.touchStartPoint.y;
            var distance = this.settings.orientation === 'horizontal' ? this.touchDistance.x : this.touchDistance.y, oppositeDistance = this.settings.orientation === 'horizontal' ? this.touchDistance.y : this.touchDistance.x;
            if (Math.abs(distance) > Math.abs(oppositeDistance)) {
                event.preventDefault()
            } else {
                return
            }
            if (this.settings.loop === false) {
                if ((this.slidesPosition > this.touchStartPosition && this.selectedSlideIndex === 0) || (this.slidesPosition < this.touchStartPosition && this.selectedSlideIndex === this.getTotalSlides() - 1)) {
                    distance = distance * 0.2
                }
            }
            this._moveTo(this.touchStartPosition + distance, true)
        },
        _onTouchEnd: function (event) {
            var that = this, touchDistance = this.settings.orientation === 'horizontal' ? this.touchDistance.x : this.touchDistance.y;
            this.$slidesMask.off(this.touchSwipeEvents.moveEvent);
            $(document).off(this.touchSwipeEvents.endEvent);
            this.$slidesMask.removeClass('sp-grabbing').addClass('sp-grab');
            if (this.isTouchMoving === false || this.isTouchMoving === true && Math.abs(this.touchDistance.x) < 10 && Math.abs(this.touchDistance.y) < 10) {
                $(event.target).parents('.sp-slide').find('a').off('click.' + NS);
                this.$slider.removeClass('sp-swiping')
            }
            setTimeout(function () {
                that.$slider.removeClass('sp-swiping')
            }, 1);
            if (this.isTouchMoving === false) {
                return
            }
            this.isTouchMoving = false;
            $(event.target).parents('.sp-slide').one('click', function (event) {
                event.preventDefault()
            });
            var oldSlidesPosition = -parseInt(this.$slides.find('.sp-slide').eq(this.selectedSlideIndex).css(this.positionProperty), 10) + this.visibleOffset;
            if (Math.abs(touchDistance) < this.settings.touchSwipeThreshold) {
                this._moveTo(oldSlidesPosition)
            } else {
                var slideArrayDistance = touchDistance / (this.slideSize + this.settings.slideDistance);
                slideArrayDistance = parseInt(slideArrayDistance, 10) + (slideArrayDistance > 0 ? 1 : -1);
                var nextSlideIndex = this.slidesOrder[$.inArray(this.selectedSlideIndex, this.slidesOrder) - slideArrayDistance];
                if (this.settings.loop === true) {
                    this.gotoSlide(nextSlideIndex)
                } else {
                    if (typeof nextSlideIndex !== 'undefined') {
                        this.gotoSlide(nextSlideIndex)
                    } else {
                        this._moveTo(oldSlidesPosition)
                    }
                }
            }
        },
        destroyTouchSwipe: function () {
            this.$slidesMask.off(this.touchSwipeEvents.startEvent);
            this.$slidesMask.off(this.touchSwipeEvents.moveEvent);
            this.$slidesMask.off('dragstart.' + NS);
            $(document).off(this.touchSwipeEvents.endEvent);
            this.$slidesMask.removeClass('sp-grab')
        },
        touchSwipeDefaults: {touchSwipe: true, touchSwipeThreshold: 50}
    };
    $.SliderPro.addModule('TouchSwipe', TouchSwipe)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Caption.' + $.SliderPro.namespace;
    var Caption = {
        $captionContainer: null, captionContent: '', initCaption: function () {
            this.on('update.' + NS, $.proxy(this._captionOnUpdate, this));
            this.on('gotoSlide.' + NS, $.proxy(this._updateCaptionContent, this))
        }, _captionOnUpdate: function () {
            this.$captionContainer = this.$slider.find('.sp-caption-container');
            if (this.$slider.find('.sp-caption').length && this.$captionContainer.length === 0) {
                this.$captionContainer = $('<div class="sp-caption-container"></div>').appendTo(this.$slider);
                this._updateCaptionContent()
            }
            this.$slides.find('.sp-caption').each(function () {
                $(this).css('display', 'none')
            })
        }, _updateCaptionContent: function () {
            var that = this, newCaptionField = this.$slider.find('.sp-slide').eq(this.selectedSlideIndex).find('.sp-caption'), newCaptionContent = newCaptionField.length !== 0 ? newCaptionField.html() : '';
            if (this.settings.fadeCaption === true) {
                if (this.captionContent !== '') {
                    if (parseFloat(this.$captionContainer.css('opacity'), 10) === 0) {
                        this.$captionContainer.css(this.vendorPrefix + 'transition', '');
                        this.$captionContainer.css('opacity', 1)
                    }
                    this._fadeCaptionTo(0, function () {
                        that.captionContent = newCaptionContent;
                        if (newCaptionContent !== '') {
                            that.$captionContainer.html(that.captionContent);
                            that._fadeCaptionTo(1)
                        } else {
                            that.$captionContainer.empty()
                        }
                    })
                } else {
                    this.captionContent = newCaptionContent;
                    this.$captionContainer.html(this.captionContent);
                    this.$captionContainer.css('opacity', 0);
                    this._fadeCaptionTo(1)
                }
            } else {
                this.captionContent = newCaptionContent;
                this.$captionContainer.html(this.captionContent)
            }
        }, _fadeCaptionTo: function (opacity, callback) {
            var that = this;
            if (this.supportedAnimation === 'css-3d' || this.supportedAnimation === 'css-2d') {
                setTimeout(function () {
                    var css = {'opacity': opacity};
                    css[that.vendorPrefix + 'transition'] = 'opacity ' + that.settings.captionFadeDuration / 1000 + 's';
                    that.$captionContainer.css(css)
                }, 1);
                this.$captionContainer.on(this.transitionEvent, function (event) {
                    if (event.target !== event.currentTarget) {
                        return
                    }
                    that.$captionContainer.off(that.transitionEvent);
                    that.$captionContainer.css(that.vendorPrefix + 'transition', '');
                    if (typeof callback === 'function') {
                        callback()
                    }
                })
            } else {
                this.$captionContainer.stop().animate({'opacity': opacity}, this.settings.captionFadeDuration, function () {
                    if (typeof callback === 'function') {
                        callback()
                    }
                })
            }
        }, destroyCaption: function () {
            this.off('update.' + NS);
            this.off('gotoSlide.' + NS);
            this.$captionContainer.remove();
            this.$slider.find('.sp-caption').each(function () {
                $(this).css('display', '')
            })
        }, captionDefaults: {fadeCaption: true, captionFadeDuration: 500}
    };
    $.SliderPro.addModule('Caption', Caption)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'DeepLinking.' + $.SliderPro.namespace;
    var DeepLinking = {
        initDeepLinking: function () {
            var that = this;
            this.on('init.' + NS, function () {
                that._gotoHash(window.location.hash)
            });
            this.on('gotoSlide.' + NS, function (event) {
                if (that.settings.updateHash === true) {
                    var slideId = that.$slider.find('.sp-slide').eq(event.index).attr('id');
                    if (typeof slideId === 'undefined') {
                        slideId = event.index
                    }
                    window.location.hash = that.$slider.attr('id') + '/' + slideId
                }
            });
            $(window).on('hashchange.' + this.uniqueId + '.' + NS, function () {
                that._gotoHash(window.location.hash)
            })
        }, _parseHash: function (hash) {
            if (hash !== '') {
                hash = hash.substring(1);
                var values = hash.split('/'), slideId = values.pop(), sliderId = hash.slice(0, -slideId.toString().length - 1);
                if (this.$slider.attr('id') === sliderId) {
                    return {'sliderID': sliderId, 'slideId': slideId}
                }
            }
            return false
        }, _gotoHash: function (hash) {
            var result = this._parseHash(hash);
            if (result === false) {
                return
            }
            var slideId = result.slideId, slideIdNumber = parseInt(slideId, 10);
            if (isNaN(slideIdNumber)) {
                var slideIndex = this.$slider.find('.sp-slide#' + slideId).index();
                if (slideIndex !== -1 && slideIndex !== this.selectedSlideIndex) {
                    this.gotoSlide(slideIndex)
                }
            } else if (slideIdNumber !== this.selectedSlideIndex) {
                this.gotoSlide(slideIdNumber)
            }
        }, destroyDeepLinking: function () {
            this.off('init.' + NS);
            this.off('gotoSlide.' + NS);
            $(window).off('hashchange.' + this.uniqueId + '.' + NS)
        }, deepLinkingDefaults: {updateHash: false}
    };
    $.SliderPro.addModule('DeepLinking', DeepLinking)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Autoplay.' + $.SliderPro.namespace;
    var Autoplay = {
        autoplayTimer: null,
        isTimerRunning: false,
        isTimerPaused: false,
        initAutoplay: function () {
            this.on('update.' + NS, $.proxy(this._autoplayOnUpdate, this))
        },
        _autoplayOnUpdate: function (event) {
            if (this.settings.autoplay === true) {
                this.on('gotoSlide.' + NS, $.proxy(this._autoplayOnGotoSlide, this));
                this.on('mouseenter.' + NS, $.proxy(this._autoplayOnMouseEnter, this));
                this.on('mouseleave.' + NS, $.proxy(this._autoplayOnMouseLeave, this));
                this.startAutoplay()
            } else {
                this.off('gotoSlide.' + NS);
                this.off('mouseenter.' + NS);
                this.off('mouseleave.' + NS);
                this.stopAutoplay()
            }
        },
        _autoplayOnGotoSlide: function (event) {
            if (this.isTimerRunning === true) {
                this.stopAutoplay()
            }
            if (this.isTimerPaused === false) {
                this.startAutoplay()
            }
        },
        _autoplayOnMouseEnter: function (event) {
            if (this.isTimerRunning && (this.settings.autoplayOnHover === 'pause' || this.settings.autoplayOnHover === 'stop')) {
                this.stopAutoplay();
                this.isTimerPaused = true
            }
        },
        _autoplayOnMouseLeave: function (event) {
            if (this.settings.autoplay === true && this.isTimerRunning === false && this.settings.autoplayOnHover !== 'stop') {
                this.startAutoplay();
                this.isTimerPaused = false
            }
        },
        startAutoplay: function () {
            var that = this;
            this.isTimerRunning = true;
            this.autoplayTimer = setTimeout(function () {
                if (that.settings.autoplayDirection === 'normal') {
                    that.nextSlide()
                } else if (that.settings.autoplayDirection === 'backwards') {
                    that.previousSlide()
                }
            }, this.settings.autoplayDelay)
        },
        stopAutoplay: function () {
            this.isTimerRunning = false;
            this.isTimerPaused = false;
            clearTimeout(this.autoplayTimer)
        },
        destroyAutoplay: function () {
            clearTimeout(this.autoplayTimer);
            this.off('update.' + NS);
            this.off('gotoSlide.' + NS);
            this.off('mouseenter.' + NS);
            this.off('mouseleave.' + NS)
        },
        autoplayDefaults: {autoplay: true, autoplayDelay: 5000, autoplayDirection: 'normal', autoplayOnHover: 'pause'}
    };
    $.SliderPro.addModule('Autoplay', Autoplay)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Keyboard.' + $.SliderPro.namespace;
    var Keyboard = {
        initKeyboard: function () {
            var that = this, hasFocus = false;
            if (this.settings.keyboard === false) {
                return
            }
            this.$slider.on('focus.' + NS, function () {
                hasFocus = true
            });
            this.$slider.on('blur.' + NS, function () {
                hasFocus = false
            });
            $(document).on('keydown.' + this.uniqueId + '.' + NS, function (event) {
                if (that.settings.keyboardOnlyOnFocus === true && hasFocus === false) {
                    return
                }
                if (event.which === 37) {
                    that.previousSlide()
                } else if (event.which === 39) {
                    that.nextSlide()
                } else if (event.which === 13) {
                    that.$slider.find('.sp-slide').eq(that.selectedSlideIndex).find('.sp-image-container a')[0].click()
                }
            })
        }, destroyKeyboard: function () {
            this.$slider.off('focus.' + NS);
            this.$slider.off('blur.' + NS);
            $(document).off('keydown.' + this.uniqueId + '.' + NS)
        }, keyboardDefaults: {keyboard: true, keyboardOnlyOnFocus: false}
    };
    $.SliderPro.addModule('Keyboard', Keyboard)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'FullScreen.' + $.SliderPro.namespace;
    var FullScreen = {
        isFullScreen: false,
        $fullScreenButton: null,
        sizeBeforeFullScreen: {},
        initFullScreen: function () {
            if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled)) {
                return
            }
            this.on('update.' + NS, $.proxy(this._fullScreenOnUpdate, this))
        },
        _fullScreenOnUpdate: function () {
            if (this.settings.fullScreen === true && this.$fullScreenButton === null) {
                this._addFullScreen()
            } else if (this.settings.fullScreen === false && this.$fullScreenButton !== null) {
                this._removeFullScreen()
            }
            if (this.settings.fullScreen === true) {
                if (this.settings.fadeFullScreen === true) {
                    this.$fullScreenButton.addClass('sp-fade-full-screen')
                } else if (this.settings.fadeFullScreen === false) {
                    this.$fullScreenButton.removeClass('sp-fade-full-screen')
                }
            }
        },
        _addFullScreen: function () {
            this.$fullScreenButton = $('<div class="sp-full-screen-button"></div>').appendTo(this.$slider);
            this.$fullScreenButton.on('click.' + NS, $.proxy(this._onFullScreenButtonClick, this));
            document.addEventListener('fullscreenchange', $.proxy(this._onFullScreenChange, this));
            document.addEventListener('mozfullscreenchange', $.proxy(this._onFullScreenChange, this));
            document.addEventListener('webkitfullscreenchange', $.proxy(this._onFullScreenChange, this));
            document.addEventListener('MSFullscreenChange', $.proxy(this._onFullScreenChange, this))
        },
        _removeFullScreen: function () {
            if (this.$fullScreenButton !== null) {
                this.$fullScreenButton.off('click.' + NS);
                this.$fullScreenButton.remove();
                this.$fullScreenButton = null;
                document.removeEventListener('fullscreenchange', this._onFullScreenChange);
                document.removeEventListener('mozfullscreenchange', this._onFullScreenChange);
                document.removeEventListener('webkitfullscreenchange', this._onFullScreenChange);
                document.removeEventListener('MSFullscreenChange', this._onFullScreenChange)
            }
        },
        _onFullScreenButtonClick: function () {
            if (this.isFullScreen === false) {
                if (this.instance.requestFullScreen) {
                    this.instance.requestFullScreen()
                } else if (this.instance.mozRequestFullScreen) {
                    this.instance.mozRequestFullScreen()
                } else if (this.instance.webkitRequestFullScreen) {
                    this.instance.webkitRequestFullScreen()
                } else if (this.instance.msRequestFullscreen) {
                    this.instance.msRequestFullscreen()
                }
            } else {
                if (document.exitFullScreen) {
                    document.exitFullScreen()
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen()
                } else if (document.webkitCancelFullScreen) {
                    document.webkitCancelFullScreen()
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen()
                }
            }
        },
        _onFullScreenChange: function () {
            this.isFullScreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement ? true : false;
            if (this.isFullScreen === true) {
                this.sizeBeforeFullScreen = {forceSize: this.settings.forceSize, autoHeight: this.settings.autoHeight};
                this.$slider.addClass('sp-full-screen');
                this.settings.forceSize = 'fullWindow';
                this.settings.autoHeight = false
            } else {
                this.$slider.css('margin', '');
                this.$slider.removeClass('sp-full-screen');
                this.settings.forceSize = this.sizeBeforeFullScreen.forceSize;
                this.settings.autoHeight = this.sizeBeforeFullScreen.autoHeight
            }
            this.resize()
        },
        destroyFullScreen: function () {
            this.off('update.' + NS);
            this._removeFullScreen()
        },
        fullScreenDefaults: {fullScreen: false, fadeFullScreen: true}
    };
    $.SliderPro.addModule('FullScreen', FullScreen)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Buttons.' + $.SliderPro.namespace;
    var Buttons = {
        $buttons: null, initButtons: function () {
            this.on('update.' + NS, $.proxy(this._buttonsOnUpdate, this))
        }, _buttonsOnUpdate: function () {
            this.$buttons = this.$slider.find('.sp-buttons');
            if (this.settings.buttons === true && this.getTotalSlides() > 1 && this.$buttons.length === 0) {
                this._createButtons()
            } else if (this.settings.buttons === true && this.getTotalSlides() !== this.$buttons.find('.sp-button').length && this.$buttons.length !== 0) {
                this._adjustButtons()
            } else if (this.settings.buttons === false || (this.getTotalSlides() <= 1 && this.$buttons.length !== 0)) {
                this._removeButtons()
            }
        }, _createButtons: function () {
            var that = this;
            this.$buttons = $('<div class="sp-buttons"></div>').appendTo(this.$slider);
            for (var i = 0; i < this.getTotalSlides(); i++) {
                $('<div class="sp-button"></div>').appendTo(this.$buttons)
            }
            this.$buttons.on('click.' + NS, '.sp-button', function () {
                that.gotoSlide($(this).index())
            });
            this.$buttons.find('.sp-button').eq(this.selectedSlideIndex).addClass('sp-selected-button');
            this.on('gotoSlide.' + NS, function (event) {
                that.$buttons.find('.sp-selected-button').removeClass('sp-selected-button');
                that.$buttons.find('.sp-button').eq(event.index).addClass('sp-selected-button')
            });
            this.$slider.addClass('sp-has-buttons')
        }, _adjustButtons: function () {
            this.$buttons.empty();
            for (var i = 0; i < this.getTotalSlides(); i++) {
                $('<div class="sp-button"></div>').appendTo(this.$buttons)
            }
            this.$buttons.find('.sp-selected-button').removeClass('sp-selected-button');
            this.$buttons.find('.sp-button').eq(this.selectedSlideIndex).addClass('sp-selected-button')
        }, _removeButtons: function () {
            this.$buttons.off('click.' + NS, '.sp-button');
            this.off('gotoSlide.' + NS);
            this.$buttons.remove();
            this.$slider.removeClass('sp-has-buttons')
        }, destroyButtons: function () {
            this._removeButtons();
            this.off('update.' + NS)
        }, buttonsDefaults: {buttons: true}
    };
    $.SliderPro.addModule('Buttons', Buttons)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Arrows.' + $.SliderPro.namespace;
    var Arrows = {
        $arrows: null, $previousArrow: null, $nextArrow: null, initArrows: function () {
            this.on('update.' + NS, $.proxy(this._arrowsOnUpdate, this));
            this.on('gotoSlide.' + NS, $.proxy(this._checkArrowsVisibility, this))
        }, _arrowsOnUpdate: function () {
            var that = this;
            if (this.settings.arrows === true && this.$arrows === null) {
                this.$arrows = $('<div class="sp-arrows"></div>').appendTo(this.$slidesContainer);
                this.$previousArrow = $('<div class="sp-arrow sp-previous-arrow"></div>').appendTo(this.$arrows);
                this.$nextArrow = $('<div class="sp-arrow sp-next-arrow"></div>').appendTo(this.$arrows);
                this.$previousArrow.on('click.' + NS, function () {
                    that.previousSlide()
                });
                this.$nextArrow.on('click.' + NS, function () {
                    that.nextSlide()
                });
                this._checkArrowsVisibility()
            } else if (this.settings.arrows === false && this.$arrows !== null) {
                this._removeArrows()
            }
            if (this.settings.arrows === true) {
                if (this.settings.fadeArrows === true) {
                    this.$arrows.addClass('sp-fade-arrows')
                } else if (this.settings.fadeArrows === false) {
                    this.$arrows.removeClass('sp-fade-arrows')
                }
            }
        }, _checkArrowsVisibility: function () {
            if (this.settings.arrows === false || this.settings.loop === true) {
                return
            }
            if (this.selectedSlideIndex === 0) {
                this.$previousArrow.css('display', 'none')
            } else {
                this.$previousArrow.css('display', 'block')
            }
            if (this.selectedSlideIndex === this.getTotalSlides() - 1) {
                this.$nextArrow.css('display', 'none')
            } else {
                this.$nextArrow.css('display', 'block')
            }
        }, _removeArrows: function () {
            if (this.$arrows !== null) {
                this.$previousArrow.off('click.' + NS);
                this.$nextArrow.off('click.' + NS);
                this.$arrows.remove();
                this.$arrows = null
            }
        }, destroyArrows: function () {
            this._removeArrows();
            this.off('update.' + NS);
            this.off('gotoSlide.' + NS)
        }, arrowsDefaults: {arrows: false, fadeArrows: true}
    };
    $.SliderPro.addModule('Arrows', Arrows)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'ThumbnailTouchSwipe.' + $.SliderPro.namespace;
    var ThumbnailTouchSwipe = {
        thumbnailTouchStartPoint: {x: 0, y: 0},
        thumbnailTouchEndPoint: {x: 0, y: 0},
        thumbnailTouchDistance: {x: 0, y: 0},
        thumbnailTouchStartPosition: 0,
        isThumbnailTouchMoving: false,
        isThumbnailTouchSwipe: false,
        thumbnailTouchSwipeEvents: {startEvent: '', moveEvent: '', endEvent: ''},
        initThumbnailTouchSwipe: function () {
            this.on('update.' + NS, $.proxy(this._thumbnailTouchSwipeOnUpdate, this))
        },
        _thumbnailTouchSwipeOnUpdate: function () {
            if (this.isThumbnailScroller === false) {
                return
            }
            if (this.settings.thumbnailTouchSwipe === true && this.isThumbnailTouchSwipe === false) {
                this.isThumbnailTouchSwipe = true;
                this.thumbnailTouchSwipeEvents.startEvent = 'touchstart' + '.' + NS + ' mousedown' + '.' + NS;
                this.thumbnailTouchSwipeEvents.moveEvent = 'touchmove' + '.' + NS + ' mousemove' + '.' + NS;
                this.thumbnailTouchSwipeEvents.endEvent = 'touchend' + '.' + this.uniqueId + '.' + NS + ' mouseup' + '.' + this.uniqueId + '.' + NS;
                this.$thumbnails.on(this.thumbnailTouchSwipeEvents.startEvent, $.proxy(this._onThumbnailTouchStart, this));
                this.$thumbnails.on('dragstart.' + NS, function (event) {
                    event.preventDefault()
                });
                this.$thumbnails.addClass('sp-grab')
            }
            $.each(this.thumbnails, function (index, thumbnail) {
                thumbnail.off('thumbnailClick')
            })
        },
        _onThumbnailTouchStart: function (event) {
            if ($(event.target).closest('.sp-selectable').length >= 1) {
                return
            }
            var that = this, eventObject = typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;
            if (typeof event.originalEvent.touches === 'undefined') {
                event.preventDefault()
            }
            $(event.target).parents('.sp-thumbnail-container').find('a').one('click.' + NS, function (event) {
                event.preventDefault()
            });
            this.thumbnailTouchStartPoint.x = eventObject.pageX || eventObject.clientX;
            this.thumbnailTouchStartPoint.y = eventObject.pageY || eventObject.clientY;
            this.thumbnailTouchStartPosition = this.thumbnailsPosition;
            this.thumbnailTouchDistance.x = this.thumbnailTouchDistance.y = 0;
            if (this.$thumbnails.hasClass('sp-animated')) {
                this.isThumbnailTouchMoving = true;
                this._stopThumbnailsMovement();
                this.thumbnailTouchStartPosition = this.thumbnailsPosition
            }
            this.$thumbnails.on(this.thumbnailTouchSwipeEvents.moveEvent, $.proxy(this._onThumbnailTouchMove, this));
            $(document).on(this.thumbnailTouchSwipeEvents.endEvent, $.proxy(this._onThumbnailTouchEnd, this));
            this.$thumbnails.removeClass('sp-grab').addClass('sp-grabbing');
            this.$thumbnailsContainer.addClass('sp-swiping')
        },
        _onThumbnailTouchMove: function (event) {
            var eventObject = typeof event.originalEvent.touches !== 'undefined' ? event.originalEvent.touches[0] : event.originalEvent;
            this.isThumbnailTouchMoving = true;
            this.thumbnailTouchEndPoint.x = eventObject.pageX || eventObject.clientX;
            this.thumbnailTouchEndPoint.y = eventObject.pageY || eventObject.clientY;
            this.thumbnailTouchDistance.x = this.thumbnailTouchEndPoint.x - this.thumbnailTouchStartPoint.x;
            this.thumbnailTouchDistance.y = this.thumbnailTouchEndPoint.y - this.thumbnailTouchStartPoint.y;
            var distance = this.thumbnailsOrientation === 'horizontal' ? this.thumbnailTouchDistance.x : this.thumbnailTouchDistance.y, oppositeDistance = this.thumbnailsOrientation === 'horizontal' ? this.thumbnailTouchDistance.y : this.thumbnailTouchDistance.x;
            if (Math.abs(distance) > Math.abs(oppositeDistance)) {
                event.preventDefault()
            } else {
                return
            }
            if (this.thumbnailsPosition >= 0) {
                var infOffset = -this.thumbnailTouchStartPosition;
                distance = infOffset + (distance - infOffset) * 0.2
            } else if (this.thumbnailsPosition <= -this.thumbnailsSize + this.thumbnailsContainerSize) {
                var supOffset = this.thumbnailsSize - this.thumbnailsContainerSize + this.thumbnailTouchStartPosition;
                distance = -supOffset + (distance + supOffset) * 0.2
            }
            this._moveThumbnailsTo(this.thumbnailTouchStartPosition + distance, true)
        },
        _onThumbnailTouchEnd: function (event) {
            var that = this, thumbnailTouchDistance = this.thumbnailsOrientation === 'horizontal' ? this.thumbnailTouchDistance.x : this.thumbnailTouchDistance.y;
            this.$thumbnails.off(this.thumbnailTouchSwipeEvents.moveEvent);
            $(document).off(this.thumbnailTouchSwipeEvents.endEvent);
            this.$thumbnails.removeClass('sp-grabbing').addClass('sp-grab');
            if (this.isThumbnailTouchMoving === false || this.isThumbnailTouchMoving === true && Math.abs(this.thumbnailTouchDistance.x) < 10 && Math.abs(this.thumbnailTouchDistance.y) < 10) {
                var targetThumbnail = $(event.target).hasClass('sp-thumbnail-container') ? $(event.target) : $(event.target).parents('.sp-thumbnail-container'), index = targetThumbnail.index();
                if ($(event.target).parents('a').length !== 0) {
                    $(event.target).parents('a').off('click.' + NS);
                    this.$thumbnailsContainer.removeClass('sp-swiping')
                } else if (index !== this.selectedThumbnailIndex && index !== -1) {
                    this.gotoSlide(index)
                }
                return
            }
            this.isThumbnailTouchMoving = false;
            $(event.target).parents('.sp-thumbnail').one('click', function (event) {
                event.preventDefault()
            });
            setTimeout(function () {
                that.$thumbnailsContainer.removeClass('sp-swiping')
            }, 1);
            if (this.thumbnailsPosition > 0) {
                this._moveThumbnailsTo(0)
            } else if (this.thumbnailsPosition < this.thumbnailsContainerSize - this.thumbnailsSize) {
                this._moveThumbnailsTo(this.thumbnailsContainerSize - this.thumbnailsSize)
            }
            this.trigger({type: 'thumbnailsMoveComplete'});
            if ($.isFunction(this.settings.thumbnailsMoveComplete)) {
                this.settings.thumbnailsMoveComplete.call(this, {type: 'thumbnailsMoveComplete'})
            }
        },
        destroyThumbnailTouchSwipe: function () {
            this.off('update.' + NS);
            if (this.isThumbnailScroller === false) {
                return
            }
            this.$thumbnails.off(this.thumbnailTouchSwipeEvents.startEvent);
            this.$thumbnails.off(this.thumbnailTouchSwipeEvents.moveEvent);
            this.$thumbnails.off('dragstart.' + NS);
            $(document).off(this.thumbnailTouchSwipeEvents.endEvent);
            this.$thumbnails.removeClass('sp-grab')
        },
        thumbnailTouchSwipeDefaults: {thumbnailTouchSwipe: true}
    };
    $.SliderPro.addModule('ThumbnailTouchSwipe', ThumbnailTouchSwipe)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'ThumbnailArrows.' + $.SliderPro.namespace;
    var ThumbnailArrows = {
        $thumbnailArrows: null,
        $previousThumbnailArrow: null,
        $nextThumbnailArrow: null,
        initThumbnailArrows: function () {
            var that = this;
            this.on('update.' + NS, $.proxy(this._thumbnailArrowsOnUpdate, this));
            this.on('sliderResize.' + NS + ' ' + 'thumbnailsMoveComplete.' + NS, function () {
                if (that.isThumbnailScroller === true && that.settings.thumbnailArrows === true) {
                    that._checkThumbnailArrowsVisibility()
                }
            })
        },
        _thumbnailArrowsOnUpdate: function () {
            var that = this;
            if (this.isThumbnailScroller === false) {
                return
            }
            if (this.settings.thumbnailArrows === true && this.$thumbnailArrows === null) {
                this.$thumbnailArrows = $('<div class="sp-thumbnail-arrows"></div>').appendTo(this.$thumbnailsContainer);
                this.$previousThumbnailArrow = $('<div class="sp-thumbnail-arrow sp-previous-thumbnail-arrow"></div>').appendTo(this.$thumbnailArrows);
                this.$nextThumbnailArrow = $('<div class="sp-thumbnail-arrow sp-next-thumbnail-arrow"></div>').appendTo(this.$thumbnailArrows);
                this.$previousThumbnailArrow.on('click.' + NS, function () {
                    var previousPosition = Math.min(0, that.thumbnailsPosition + that.thumbnailsContainerSize);
                    that._moveThumbnailsTo(previousPosition)
                });
                this.$nextThumbnailArrow.on('click.' + NS, function () {
                    var nextPosition = Math.max(that.thumbnailsContainerSize - that.thumbnailsSize, that.thumbnailsPosition - that.thumbnailsContainerSize);
                    that._moveThumbnailsTo(nextPosition)
                })
            } else if (this.settings.thumbnailArrows === false && this.$thumbnailArrows !== null) {
                this._removeThumbnailArrows()
            }
            if (this.settings.thumbnailArrows === true) {
                if (this.settings.fadeThumbnailArrows === true) {
                    this.$thumbnailArrows.addClass('sp-fade-thumbnail-arrows')
                } else if (this.settings.fadeThumbnailArrows === false) {
                    this.$thumbnailArrows.removeClass('sp-fade-thumbnail-arrows')
                }
                this._checkThumbnailArrowsVisibility()
            }
        },
        _checkThumbnailArrowsVisibility: function () {
            if (this.thumbnailsPosition === 0) {
                this.$previousThumbnailArrow.css('display', 'none')
            } else {
                this.$previousThumbnailArrow.css('display', 'block')
            }
            if (this.thumbnailsPosition === this.thumbnailsContainerSize - this.thumbnailsSize) {
                this.$nextThumbnailArrow.css('display', 'none')
            } else {
                this.$nextThumbnailArrow.css('display', 'block')
            }
        },
        _removeThumbnailArrows: function () {
            if (this.$thumbnailArrows !== null) {
                this.$previousThumbnailArrow.off('click.' + NS);
                this.$nextThumbnailArrow.off('click.' + NS);
                this.$thumbnailArrows.remove();
                this.$thumbnailArrows = null
            }
        },
        destroyThumbnailArrows: function () {
            this._removeThumbnailArrows();
            this.off('update.' + NS);
            this.off('sliderResize.' + NS);
            this.off('thumbnailsMoveComplete.' + NS)
        },
        thumbnailArrowsDefaults: {thumbnailArrows: false, fadeThumbnailArrows: true}
    };
    $.SliderPro.addModule('ThumbnailArrows', ThumbnailArrows)
})(window, jQuery);
(function (window, $) {
    "use strict";
    var NS = 'Video.' + $.SliderPro.namespace;
    var Video = {
        initVideo: function () {
            this.on('update.' + NS, $.proxy(this._videoOnUpdate, this));
            this.on('gotoSlideComplete.' + NS, $.proxy(this._videoOnGotoSlideComplete, this))
        },
        _videoOnUpdate: function () {
            var that = this;
            this.$slider.find('.sp-video').not('a, [data-video-init]').each(function () {
                var video = $(this);
                that._initVideo(video)
            });
            this.$slider.find('a.sp-video').not('[data-video-preinit]').each(function () {
                var video = $(this);
                that._preinitVideo(video)
            })
        },
        _initVideo: function (video) {
            var that = this;
            video.attr('data-video-init', true).videoController();
            video.on('videoPlay.' + NS, function () {
                if (that.settings.playVideoAction === 'stopAutoplay' && typeof that.stopAutoplay !== 'undefined') {
                    that.stopAutoplay();
                    that.settings.autoplay = false
                }
                var eventObject = {type: 'videoPlay', video: video};
                that.trigger(eventObject);
                if ($.isFunction(that.settings.videoPlay)) {
                    that.settings.videoPlay.call(that, eventObject)
                }
            });
            video.on('videoPause.' + NS, function () {
                if (that.settings.pauseVideoAction === 'startAutoplay' && typeof that.startAutoplay !== 'undefined') {
                    that.startAutoplay();
                    that.settings.autoplay = true
                }
                var eventObject = {type: 'videoPause', video: video};
                that.trigger(eventObject);
                if ($.isFunction(that.settings.videoPause)) {
                    that.settings.videoPause.call(that, eventObject)
                }
            });
            video.on('videoEnded.' + NS, function () {
                if (that.settings.endVideoAction === 'startAutoplay' && typeof that.startAutoplay !== 'undefined') {
                    that.startAutoplay();
                    that.settings.autoplay = true
                } else if (that.settings.endVideoAction === 'nextSlide') {
                    that.nextSlide()
                } else if (that.settings.endVideoAction === 'replayVideo') {
                    video.videoController('replay')
                }
                var eventObject = {type: 'videoEnd', video: video};
                that.trigger(eventObject);
                if ($.isFunction(that.settings.videoEnd)) {
                    that.settings.videoEnd.call(that, eventObject)
                }
            })
        },
        _preinitVideo: function (video) {
            var that = this;
            video.attr('data-video-preinit', true);
            video.on('click.' + NS, function (event) {
                if (that.$slider.hasClass('sp-swiping')) {
                    return
                }
                event.preventDefault();
                var href = video.attr('href'), iframe, provider, regExp, match, id, src, videoAttributes, videoWidth = video.children('img').attr('width'), videoHeight = video.children('img').attr('height');
                if (href.indexOf('youtube') !== -1 || href.indexOf('youtu.be') !== -1) {
                    provider = 'youtube'
                } else if (href.indexOf('vimeo') !== -1) {
                    provider = 'vimeo'
                }
                regExp = provider === 'youtube' ? /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/ : /http:\/\/(www\.)?vimeo.com\/(\d+)/;
                match = href.match(regExp);
                id = match[2];
                src = provider === 'youtube' ? 'http://www.youtube.com/embed/' + id + '?enablejsapi=1&wmode=opaque' : 'http://player.vimeo.com/video/' + id + '?api=1';
                videoAttributes = href.split('?')[1];
                if (typeof videoAttributes !== 'undefined') {
                    videoAttributes = videoAttributes.split('&');
                    $.each(videoAttributes, function (index, value) {
                        if (value.indexOf(id) === -1) {
                            src += '&' + value
                        }
                    })
                }
                iframe = $('<iframe></iframe>').attr({
                    'src': src,
                    'width': videoWidth,
                    'height': videoHeight,
                    'class': video.attr('class'),
                    'frameborder': 0,
                    'allowfullscreen': 'allowfullscreen'
                }).insertBefore(video);
                that._initVideo(iframe);
                iframe.videoController('play');
                video.css('display', 'none')
            })
        },
        _videoOnGotoSlideComplete: function (event) {
            var previousVideo = this.$slides.find('.sp-slide').eq(event.previousIndex).find('.sp-video[data-video-init]');
            if (event.previousIndex !== -1 && previousVideo.length !== 0) {
                if (this.settings.leaveVideoAction === 'stopVideo') {
                    previousVideo.videoController('stop')
                } else if (this.settings.leaveVideoAction === 'pauseVideo') {
                    previousVideo.videoController('pause')
                } else if (this.settings.leaveVideoAction === 'removeVideo') {
                    if (previousVideo.siblings('a.sp-video').length !== 0) {
                        previousVideo.siblings('a.sp-video').css('display', '');
                        previousVideo.videoController('destroy');
                        previousVideo.remove()
                    } else {
                        previousVideo.videoController('stop')
                    }
                }
            }
            if (this.settings.reachVideoAction === 'playVideo') {
                var loadedVideo = this.$slides.find('.sp-slide').eq(event.index).find('.sp-video[data-video-init]'), unloadedVideo = this.$slides.find('.sp-slide').eq(event.index).find('.sp-video[data-video-preinit]');
                if (loadedVideo.length !== 0) {
                    loadedVideo.videoController('play')
                } else if (unloadedVideo.length !== 0) {
                    unloadedVideo.trigger('click.' + NS)
                }
            }
        },
        destroyVideo: function () {
            this.$slider.find('.sp-video[ data-video-preinit ]').each(function () {
                var video = $(this);
                video.removeAttr('data-video-preinit');
                video.off('click.' + NS)
            });
            this.$slider.find('.sp-video[ data-video-init ]').each(function () {
                var video = $(this);
                video.removeAttr('data-video-init');
                video.off('Video');
                video.videoController('destroy')
            });
            this.off('update.' + NS);
            this.off('gotoSlideComplete.' + NS)
        },
        videoDefaults: {
            reachVideoAction: 'none',
            leaveVideoAction: 'pauseVideo',
            playVideoAction: 'stopAutoplay',
            pauseVideoAction: 'none',
            endVideoAction: 'none',
            videoPlay: function () {
            },
            videoPause: function () {
            },
            videoEnd: function () {
            }
        }
    };
    $.SliderPro.addModule('Video', Video)
})(window, jQuery);
(function ($) {
    "use strict";
    var isIOS = window.navigator.userAgent.match(/(iPad|iPhone|iPod)/g) ? true : false;
    var VideoController = function (instance, options) {
        this.$video = $(instance);
        this.options = options;
        this.settings = {};
        this.player = null;
        this._init()
    };
    VideoController.prototype = {
        _init: function () {
            this.settings = $.extend({}, this.defaults, this.options);
            var that = this, players = $.VideoController.players, videoID = this.$video.attr('id');
            for (var name in players) {
                if (typeof players[name] !== 'undefined' && players[name].isType(this.$video)) {
                    this.player = new players[name](this.$video);
                    break
                }
            }
            if (this.player === null) {
                return
            }
            var events = ['ready', 'start', 'play', 'pause', 'ended'];
            $.each(events, function (index, element) {
                var event = 'video' + element.charAt(0).toUpperCase() + element.slice(1);
                that.player.on(element, function () {
                    that.trigger({type: event, video: videoID});
                    if ($.isFunction(that.settings[event])) {
                        that.settings[event].call(that, {type: event, video: videoID})
                    }
                })
            })
        }, play: function () {
            if (isIOS === true && this.player.isStarted() === false || this.player.getState() === 'playing') {
                return
            }
            this.player.play()
        }, stop: function () {
            if (isIOS === true && this.player.isStarted() === false || this.player.getState() === 'stopped') {
                return
            }
            this.player.stop()
        }, pause: function () {
            if (isIOS === true && this.player.isStarted() === false || this.player.getState() === 'paused') {
                return
            }
            this.player.pause()
        }, replay: function () {
            if (isIOS === true && this.player.isStarted() === false) {
                return
            }
            this.player.replay()
        }, on: function (type, callback) {
            return this.$video.on(type, callback)
        }, off: function (type) {
            return this.$video.off(type)
        }, trigger: function (data) {
            return this.$video.triggerHandler(data)
        }, destroy: function () {
            if (this.player.isStarted() === true) {
                this.stop()
            }
            this.player.off('ready');
            this.player.off('start');
            this.player.off('play');
            this.player.off('pause');
            this.player.off('ended');
            this.$video.removeData('videoController')
        }, defaults: {
            videoReady: function () {
            }, videoStart: function () {
            }, videoPlay: function () {
            }, videoPause: function () {
            }, videoEnded: function () {
            }
        }
    };
    $.VideoController = {
        players: {}, addPlayer: function (name, player) {
            this.players[name] = player
        }
    };
    $.fn.videoController = function (options) {
        var args = Array.prototype.slice.call(arguments, 1);
        return this.each(function () {
            if (typeof $(this).data('videoController') === 'undefined') {
                var newInstance = new VideoController(this, options);
                $(this).data('videoController', newInstance)
            } else if (typeof options !== 'undefined') {
                var currentInstance = $(this).data('videoController');
                if (typeof currentInstance[options] === 'function') {
                    currentInstance[options].apply(currentInstance, args)
                } else {
                    $.error(options + ' does not exist in videoController.')
                }
            }
        })
    };
    var Video = function (video) {
        this.$video = video;
        this.player = null;
        this.ready = false;
        this.started = false;
        this.state = '';
        this.events = $({});
        this._init()
    };
    Video.prototype = {
        _init: function () {
        }, play: function () {
        }, pause: function () {
        }, stop: function () {
        }, replay: function () {
        }, isType: function () {
        }, isReady: function () {
            return this.ready
        }, isStarted: function () {
            return this.started
        }, getState: function () {
            return this.state
        }, on: function (type, callback) {
            return this.events.on(type, callback)
        }, off: function (type) {
            return this.events.off(type)
        }, trigger: function (data) {
            return this.events.triggerHandler(data)
        }
    };
    var YoutubeVideoHelper = {youtubeAPIAdded: false, youtubeVideos: []};
    var YoutubeVideo = function (video) {
        this.init = false;
        var youtubeAPILoaded = window.YT && window.YT.Player;
        if (typeof youtubeAPILoaded !== 'undefined') {
            Video.call(this, video)
        } else {
            YoutubeVideoHelper.youtubeVideos.push({'video': video, 'scope': this});
            if (YoutubeVideoHelper.youtubeAPIAdded === false) {
                YoutubeVideoHelper.youtubeAPIAdded = true;
                var tag = document.createElement('script');
                tag.src = "http://www.youtube.com/player_api";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                window.onYouTubePlayerAPIReady = function () {
                    $.each(YoutubeVideoHelper.youtubeVideos, function (index, element) {
                        Video.call(element.scope, element.video)
                    })
                }
            }
        }
    };
    YoutubeVideo.prototype = new Video();
    YoutubeVideo.prototype.constructor = YoutubeVideo;
    $.VideoController.addPlayer('YoutubeVideo', YoutubeVideo);
    YoutubeVideo.isType = function (video) {
        if (video.is('iframe')) {
            var src = video.attr('src');
            if (src.indexOf('youtube.com') !== -1 || src.indexOf('youtu.be') !== -1) {
                return true
            }
        }
        return false
    };
    YoutubeVideo.prototype._init = function () {
        this.init = true;
        this._setup()
    };
    YoutubeVideo.prototype._setup = function () {
        var that = this;
        this.player = new YT.Player(this.$video[0], {
            events: {
                'onReady': function () {
                    that.trigger({type: 'ready'});
                    that.ready = true
                }, 'onStateChange': function (event) {
                    switch (event.data) {
                        case YT.PlayerState.PLAYING:
                            if (that.started === false) {
                                that.started = true;
                                that.trigger({type: 'start'})
                            }
                            that.state = 'playing';
                            that.trigger({type: 'play'});
                            break;
                        case YT.PlayerState.PAUSED:
                            that.state = 'paused';
                            that.trigger({type: 'pause'});
                            break;
                        case YT.PlayerState.ENDED:
                            that.state = 'ended';
                            that.trigger({type: 'ended'});
                            break
                    }
                }
            }
        })
    };
    YoutubeVideo.prototype.play = function () {
        var that = this;
        if (this.ready === true) {
            this.player.playVideo()
        } else {
            var timer = setInterval(function () {
                if (that.ready === true) {
                    clearInterval(timer);
                    that.player.playVideo()
                }
            }, 100)
        }
    };
    YoutubeVideo.prototype.pause = function () {
        if (isIOS === true) {
            this.stop()
        } else {
            this.player.pauseVideo()
        }
    };
    YoutubeVideo.prototype.stop = function () {
        this.player.seekTo(1);
        this.player.stopVideo();
        this.state = 'stopped'
    };
    YoutubeVideo.prototype.replay = function () {
        this.player.seekTo(1);
        this.player.playVideo()
    };
    YoutubeVideo.prototype.on = function (type, callback) {
        var that = this;
        if (this.init === true) {
            Video.prototype.on.call(this, type, callback)
        } else {
            var timer = setInterval(function () {
                if (that.init === true) {
                    clearInterval(timer);
                    Video.prototype.on.call(that, type, callback)
                }
            }, 100)
        }
    };
    var VimeoVideoHelper = {vimeoAPIAdded: false, vimeoVideos: []};
    var VimeoVideo = function (video) {
        this.init = false;
        if (typeof window.Froogaloop !== 'undefined') {
            Video.call(this, video)
        } else {
            VimeoVideoHelper.vimeoVideos.push({'video': video, 'scope': this});
            if (VimeoVideoHelper.vimeoAPIAdded === false) {
                VimeoVideoHelper.vimeoAPIAdded = true;
                var tag = document.createElement('script');
                tag.src = "http://a.vimeocdn.com/js/froogaloop2.min.js";
                var firstScriptTag = document.getElementsByTagName('script')[0];
                firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                var checkVimeoAPITimer = setInterval(function () {
                    if (typeof window.Froogaloop !== 'undefined') {
                        clearInterval(checkVimeoAPITimer);
                        $.each(VimeoVideoHelper.vimeoVideos, function (index, element) {
                            Video.call(element.scope, element.video)
                        })
                    }
                }, 100)
            }
        }
    };
    VimeoVideo.prototype = new Video();
    VimeoVideo.prototype.constructor = VimeoVideo;
    $.VideoController.addPlayer('VimeoVideo', VimeoVideo);
    VimeoVideo.isType = function (video) {
        if (video.is('iframe')) {
            var src = video.attr('src');
            if (src.indexOf('vimeo.com') !== -1) {
                return true
            }
        }
        return false
    };
    VimeoVideo.prototype._init = function () {
        this.init = true;
        this._setup()
    };
    VimeoVideo.prototype._setup = function () {
        var that = this;
        this.player = $f(this.$video[0]);
        this.player.addEvent('ready', function () {
            that.ready = true;
            that.trigger({type: 'ready'});
            that.player.addEvent('play', function () {
                if (that.started === false) {
                    that.started = true;
                    that.trigger({type: 'start'})
                }
                that.state = 'playing';
                that.trigger({type: 'play'})
            });
            that.player.addEvent('pause', function () {
                that.state = 'paused';
                that.trigger({type: 'pause'})
            });
            that.player.addEvent('finish', function () {
                that.state = 'ended';
                that.trigger({type: 'ended'})
            })
        })
    };
    VimeoVideo.prototype.play = function () {
        var that = this;
        if (this.ready === true) {
            this.player.api('play')
        } else {
            var timer = setInterval(function () {
                if (that.ready === true) {
                    clearInterval(timer);
                    that.player.api('play')
                }
            }, 100)
        }
    };
    VimeoVideo.prototype.pause = function () {
        this.player.api('pause')
    };
    VimeoVideo.prototype.stop = function () {
        this.player.api('seekTo', 0);
        this.player.api('pause');
        this.state = 'stopped'
    };
    VimeoVideo.prototype.replay = function () {
        this.player.api('seekTo', 0);
        this.player.api('play')
    };
    VimeoVideo.prototype.on = function (type, callback) {
        var that = this;
        if (this.init === true) {
            Video.prototype.on.call(this, type, callback)
        } else {
            var timer = setInterval(function () {
                if (that.init === true) {
                    clearInterval(timer);
                    Video.prototype.on.call(that, type, callback)
                }
            }, 100)
        }
    };
    var HTML5Video = function (video) {
        Video.call(this, video)
    };
    HTML5Video.prototype = new Video();
    HTML5Video.prototype.constructor = HTML5Video;
    $.VideoController.addPlayer('HTML5Video', HTML5Video);
    HTML5Video.isType = function (video) {
        if (video.is('video') && video.hasClass('video-js') === false && video.hasClass('sublime') === false) {
            return true
        }
        return false
    };
    HTML5Video.prototype._init = function () {
        var that = this;
        this.player = this.$video[0];
        this.ready = true;
        this.player.addEventListener('play', function () {
            if (that.started === false) {
                that.started = true;
                that.trigger({type: 'start'})
            }
            that.state = 'playing';
            that.trigger({type: 'play'})
        });
        this.player.addEventListener('pause', function () {
            that.state = 'paused';
            that.trigger({type: 'pause'})
        });
        this.player.addEventListener('ended', function () {
            that.state = 'ended';
            that.trigger({type: 'ended'})
        })
    };
    HTML5Video.prototype.play = function () {
        this.player.play()
    };
    HTML5Video.prototype.pause = function () {
        this.player.pause()
    };
    HTML5Video.prototype.stop = function () {
        this.player.currentTime = 0;
        this.player.pause();
        this.state = 'stopped'
    };
    HTML5Video.prototype.replay = function () {
        this.player.currentTime = 0;
        this.player.play()
    };
    var VideoJSVideo = function (video) {
        Video.call(this, video)
    };
    VideoJSVideo.prototype = new Video();
    VideoJSVideo.prototype.constructor = VideoJSVideo;
    $.VideoController.addPlayer('VideoJSVideo', VideoJSVideo);
    VideoJSVideo.isType = function (video) {
        if ((typeof video.attr('data-videojs-id') !== 'undefined' || video.hasClass('video-js')) && typeof videojs !== 'undefined') {
            return true
        }
        return false
    };
    VideoJSVideo.prototype._init = function () {
        var that = this, videoID = this.$video.hasClass('video-js') ? this.$video.attr('id') : this.$video.attr('data-videojs-id');
        this.player = videojs(videoID);
        this.player.ready(function () {
            that.ready = true;
            that.trigger({type: 'ready'});
            that.player.on('play', function () {
                if (that.started === false) {
                    that.started = true;
                    that.trigger({type: 'start'})
                }
                that.state = 'playing';
                that.trigger({type: 'play'})
            });
            that.player.on('pause', function () {
                that.state = 'paused';
                that.trigger({type: 'pause'})
            });
            that.player.on('ended', function () {
                that.state = 'ended';
                that.trigger({type: 'ended'})
            })
        })
    };
    VideoJSVideo.prototype.play = function () {
        this.player.play()
    };
    VideoJSVideo.prototype.pause = function () {
        this.player.pause()
    };
    VideoJSVideo.prototype.stop = function () {
        this.player.currentTime(0);
        this.player.pause();
        this.state = 'stopped'
    };
    VideoJSVideo.prototype.replay = function () {
        this.player.currentTime(0);
        this.player.play()
    };
    var SublimeVideo = function (video) {
        Video.call(this, video)
    };
    SublimeVideo.prototype = new Video();
    SublimeVideo.prototype.constructor = SublimeVideo;
    $.VideoController.addPlayer('SublimeVideo', SublimeVideo);
    SublimeVideo.isType = function (video) {
        if (video.hasClass('sublime') && typeof sublime !== 'undefined') {
            return true
        }
        return false
    };
    SublimeVideo.prototype._init = function () {
        var that = this;
        sublime.ready(function () {
            that.player = sublime.player(that.$video.attr('id'));
            that.ready = true;
            that.trigger({type: 'ready'});
            that.player.on('play', function () {
                if (that.started === false) {
                    that.started = true;
                    that.trigger({type: 'start'})
                }
                that.state = 'playing';
                that.trigger({type: 'play'})
            });
            that.player.on('pause', function () {
                that.state = 'paused';
                that.trigger({type: 'pause'})
            });
            that.player.on('stop', function () {
                that.state = 'stopped';
                that.trigger({type: 'stop'})
            });
            that.player.on('end', function () {
                that.state = 'ended';
                that.trigger({type: 'ended'})
            })
        })
    };
    SublimeVideo.prototype.play = function () {
        this.player.play()
    };
    SublimeVideo.prototype.pause = function () {
        this.player.pause()
    };
    SublimeVideo.prototype.stop = function () {
        this.player.stop()
    };
    SublimeVideo.prototype.replay = function () {
        this.player.stop();
        this.player.play()
    };
    var JWPlayerVideo = function (video) {
        Video.call(this, video)
    };
    JWPlayerVideo.prototype = new Video();
    JWPlayerVideo.prototype.constructor = JWPlayerVideo;
    $.VideoController.addPlayer('JWPlayerVideo', JWPlayerVideo);
    JWPlayerVideo.isType = function (video) {
        if ((typeof video.attr('data-jwplayer-id') !== 'undefined' || video.hasClass('jwplayer') || video.find("object[data*='jwplayer']").length !== 0) && typeof jwplayer !== 'undefined') {
            return true
        }
        return false
    };
    JWPlayerVideo.prototype._init = function () {
        var that = this, videoID;
        if (this.$video.hasClass('jwplayer')) {
            videoID = this.$video.attr('id')
        } else if (typeof this.$video.attr('data-jwplayer-id') !== 'undefined') {
            videoID = this.$video.attr('data-jwplayer-id')
        } else if (this.$video.find("object[data*='jwplayer']").length !== 0) {
            videoID = this.$video.find('object').attr('id')
        }
        this.player = jwplayer(videoID);
        this.player.onReady(function () {
            that.ready = true;
            that.trigger({type: 'ready'});
            that.player.onPlay(function () {
                if (that.started === false) {
                    that.started = true;
                    that.trigger({type: 'start'})
                }
                that.state = 'playing';
                that.trigger({type: 'play'})
            });
            that.player.onPause(function () {
                that.state = 'paused';
                that.trigger({type: 'pause'})
            });
            that.player.onComplete(function () {
                that.state = 'ended';
                that.trigger({type: 'ended'})
            })
        })
    };
    JWPlayerVideo.prototype.play = function () {
        this.player.play(true)
    };
    JWPlayerVideo.prototype.pause = function () {
        this.player.pause(true)
    };
    JWPlayerVideo.prototype.stop = function () {
        this.player.stop();
        this.state = 'stopped'
    };
    JWPlayerVideo.prototype.replay = function () {
        this.player.seek(0);
        this.player.play(true)
    }
})(jQuery);
