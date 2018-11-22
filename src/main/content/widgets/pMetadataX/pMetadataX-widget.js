/**
 * Cleans the given input entity from attributes which cannot
 * be handled by the server. The only attribute known to cause
 * these issues at this time is 'children-omitted'.
 *
 * @param entity The entity to clean
 */
var cleanEntity = function(entity) {
  delete entity['children-omitted'];

  (entity.entities || []).forEach(cleanEntity);
};

/**
 * Returns the entity represented by the given entity path
 * string, including any child entities.
 *
 * @param pathString The entity string representing the entity to return
 */
var entityFromPath = function(pathString) {
  return entityFromList(pathString.split("/"));
};

/**
 * Returns the entity represented by the given entity strings,
 * including any child entities.
 *
 * @param entityStrings The entity strings representing the entity to return
 */
var entityFromList = function(entityStrings) {
  return {
    id: entityStrings[0],
    name: entityStrings[0],
    entities: entityStrings.length > 1 ? [entityFromList(entityStrings.slice(1))] : [],
    attributes: []
  };
};

/**
 * Returns the path (name) representation of the given entity,
 * including any child entities.
 *
 * @param entity The entity to return the path representation for
 */
var entityToPath = function(entity) {
  return entityToPathArray(entity).join('/');
};

/**
 * Returns the path (name) representation of the given entity as an array,
 * including any child entities.
 *
 * @param entity The entity to return the path representation for
 */
var entityToPathArray = function(entity) {
  var pathArray = [entity.name];

  if (typeof entity.entities !== 'undefined' && entity.entities.length > 0) {
    pathArray = pathArray.concat(entityToPathArray(entity.entities[0]));
  }

  return pathArray;
};

/**
 * Finds the the entity represented by the given entity path
 * in the given list of entities.
 *
 * @param entities The list of entities to search for the requested entity
 * @param entityPathArray The entity path (as array) representing the requested entity
 */
var findEntityByPath = function(entities, entityPathArray) {
  var foundEntity = undefined;

  if (typeof entities !== 'undefined' && typeof entityPathArray !== 'undefined' && entityPathArray.length > 0) {
    var matchingEntities = entities.filter(function(entity) {
      return entity.name === entityPathArray[0];
    });

    if (matchingEntities.length > 0) {
      entityPathArray.splice(0, 1);

      if (entityPathArray.length === 0) {
        foundEntity = matchingEntities[0];
      } else {
        for (var i = 0; i < matchingEntities.length; i++) {
          foundEntity = findEntityByPath(matchingEntities[i].entities, entityPathArray);

          if (typeof foundEntity !== 'undefined') {
            break;
          }
        }
      }
    }
  }

  return foundEntity;
};

/**
 * Returns the ID of the entity leaf (the last child) for the
 * given entity hierarchy.
 *
 * @param entity The entity from which to extract the leaf entity ID
 */
var getLeafEntityId = function(entity) {
  var children = entity.entities || [];

  if (children.length > 0) {
    return getLeafEntityId(children[0]);
  }

  return entity.id;
};

/**
 * Closes all visible popovers, with the exception of the
 * provided element, which will be kept open.
 *
 * @param popoverIdToKeep The id of a popover which should be kept open
 */
var closeVisiblePopovers = function(popoverIdToKeep) {
  $('.popover:visible').each(function(index, element) {
    var popoverId = $(element) ? $(element).attr('id') : "";

    if (popoverId !== popoverIdToKeep) {
      $(element).data('bs.popover').$element.popover('hide');
    }
  });
};

/**
 * Constructs html for attributes to be displayed in a popover.
 *
 * @param entityContentId The content ID of a content-backed entity to be used as reference
 * @param attributes The attributes to be displayed in the popover
 */
var buildAttributesPopoverContent = function(entityContentId, attributes) {
  attributes = attributes || [];

  var html = "<div class='attribute-popover'>";

  var truncated = attributes.length > 10;

  var writeAttributeString = function(value, maxCharacters, attributeClass) {
    var stringValue = value || '';
    attributeClass = attributeClass || '';

    var truncatedValue = '';

    if (stringValue.length > maxCharacters) {
      stringValue = stringValue.substring(0, maxCharacters);
      truncatedValue = value.substring(maxCharacters);

      truncated = true;
    }

    html += "<span class='" + attributeClass + "'>" + stringValue + "</span>";

    if (truncatedValue.length > 0) {
      html += "<span class='" + attributeClass +" less'>...</span>";
      html += "<span class='" + attributeClass + " more'>" + truncatedValue + "</span>";
    }
  };

  var writeAttributes = function(attributes) {
    attributes.slice(0, 10).forEach(function(attribute) {
      html += "<div><strong>";

      writeAttributeString(attribute.name, 25, "attribute-name");

      html += ":</strong> ";

      writeAttributeString(attribute.value, 200, "attribute-value");

      html += "</div>";
    });
  };

  if (attributes.length > 0) {
    writeAttributes(attributes);
  } else {
    html += '<span class=\"text-muted\"><em>No attributes defined...</em></span>';
  }

  html += "<hr/>";

  if (typeof entityContentId !== 'undefined') {
    if (truncated === true) {
      html += "<span class=\"text-muted\"><em>Information was truncated, more info available on content</em> " + entityContentId + "</span>";
    } else {
      html += "<span class=\"text-muted\"><strong>Content ID:</strong> " + entityContentId + "</span>";
    }
  }

  html += "</div>";

  return html;
};

atex.onecms.register('ng-directive', 'pMetadataX', ['select2','sortable'], function(select2, sortable) {
  angular.module('atex.onecms.ui.widgets').registerDirective('pMetadataXTreeEntity', ['$compile', 'MetadataService',
    function($compile, MetadataService) {
      return {
        scope: {
          'entity': '=',
          'selectedEntityIds': '=',
          'addEntity': '&',
          'removeEntity': '&',
          'leafOnly': '@leafOnly',
          'maximumSelectionSize' : '@maximumSelectionSize'

        },

        controller: function($scope) {
          $scope.select2BaseUrl = '/onecms/polopoly_fs/atex.onecms.Widget-pBaseSelect2!';

          $scope.isOpen = false;
          $scope.isLoading = false;
          $scope.error = false;

          $scope.orderable = true;

          $scope.isExpandable = $scope.entity.entities.length > 0 || $scope.entity['children-omitted'] === true;

          $scope.addEntity = (typeof $scope.addEntity !== 'undefined') ? $scope.addEntity() : function() {};
          $scope.removeEntity = (typeof $scope.removeEntity !== 'undefined') ? $scope.removeEntity() : function() {};

          $scope.isSelected = function() {
            return $scope.selectedEntityIds.indexOf($scope.entity.id) !== -1;
          };

          $scope.toggleOpen = function() {
            $scope.isOpen = !$scope.isOpen;

            if ($scope.entity['children-omitted'] === false || $scope.isLoading === true) {
              return;
            }

            $scope.isLoading = true;
            $scope.error = false;

            MetadataService.getStructure({ id: $scope.entity.id, depth: 1 }).then(function(result) {
              $scope.entity['children-omitted'] = false;
              $scope.entity.entities = result.data.entities;

              $scope.isLoading = false;
            }).then(undefined, function(error) {
              $scope.isLoading = false;

              $scope.error = true;
              $scope.isOpen = false;

              console.log("Error while reading metadata structure for '" + $scope.entity.id + "'!", error);
            });
          };

          $scope.toggleSelection = function() {
            if ($scope.leafOnly === true && $scope.isExpandable) return;

            closeVisiblePopovers();
            if ($scope.isSelected() === true) {
              $scope.removeEntity($scope.entity);
            } else {
              if ($scope.maximumSelectionSize > 0 && $scope.selectedEntityIds.length >= $scope.maximumSelectionSize) {
                $scope.removeEntity({id:$scope.selectedEntityIds[$scope.selectedEntityIds.length-1]});
              }
              var entityClone = JSON.parse(JSON.stringify($scope.entity));
              entityClone.entities = [];

              $scope.addEntity(entityClone);
            }
          };

          $scope.addChildEntity = function(childEntity) {
            var clone = JSON.parse(JSON.stringify($scope.entity));
            clone.entities = [ childEntity ];

            $scope.addEntity(clone);
          };

        },

        link: function(scope, element, attr, ctrl) {
          var html = '<i x-ng-show="isExpandable" x-ng-click="toggleOpen()" class="entity-toggle fa fa-fw" x-ng-class="{ \'fa-caret-right\': !isOpen, \'fa-caret-down\': isOpen }"></i>' +
                     '<span class="entity-label" x-ng-class="{ \'selected\': isSelected() }" x-ng-click="toggleSelection()">{{entity.name}}</span>' +
                     '<i x-ng-show="isLoading" class="fa fa-spinner fa-spin status-icon"></i>' +
                     '<i x-ng-show="error" class="fa fa-warning status-icon text-danger"></i>' +
                     '<ul x-ng-show="isOpen" class="metadata-tree list-unstyled">' +
                       '<li x-ng-repeat="childEntity in entity.entities" x-p-metadata-tree-entity data-selected-entity-ids="selectedEntityIds" data-leaf-only="{{leafOnly}}" data-maximum-selection-size="{{maximumSelectionSize}}" data-add-entity="addChildEntity" data-remove-entity="removeEntity" data-entity="childEntity"></li>' +
                     '</ul>';

          if (scope.isExpandable === true) {
            element.addClass('expandable');
          }

          element.html(html);
          $compile(element.contents())(scope);

        }
      };
    }
  ]);

  angular.module('atex.onecms.ui.widgets').registerDirective('pMetadataXTreeDimension', ['MetadataService','$http','$location',
    function(MetadataService,$http, $location) {
      return {
        require: '^ngModel',
        priority: 1, // Needed since we're using x-ng-model on the same element

        scope: {
          model: '=ngModel',
          'leafOnly': '@leafOnly',
          'maximumSelectionSize' : '@maximumSelectionSize'

        },

        templateUrl: atex.onecms.baseUrl + '/tree-template.html',

        controller: function($scope) {
          $scope.isLoading = true;
          $scope.error = false;

          $scope.selectedEntityIds = [];
        },

        link: function(scope, element, attr, ngModel) {
          scope.dimensionId = attr.dimensionId;

          scope.treeStyle = {
            maxHeight: attr.maxHeight + "px"
          };

          MetadataService.getStructure({ id: scope.dimensionId, depth: attr.preloadDepth }).then(function(result) {
            scope.isLoading = false;
            scope.entities = result.data.entities;
          }).then(null, function(error) {
            scope.isLoading = false;
            scope.error = true;

            console.log("Error while reading metatadata structure for '" + scope.dimensionId + "'!", error);
          });

          scope.addEntity = function(entity) {
            cleanEntity(entity);

            ngModel.$setViewValue(ngModel.$viewValue.concat([entity]));
            scope.selectedEntityIds.push(getLeafEntityId(entity));
          };

          scope.removeEntity = function(entity) {
            var existingEntity = _.find(ngModel.$viewValue, function(existingEntity) {
              return getLeafEntityId(existingEntity) === entity.id;
            });

            ngModel.$setViewValue(_.without(ngModel.$viewValue, existingEntity));
            scope.selectedEntityIds = _.without(scope.selectedEntityIds, entity.id);
          };

          scope.$watch('model', function(newValue, oldValue) {
            if (newValue !== oldValue) {
              ngModel.$render();
            }
          }, true);

          ngModel.$render = function() {
            scope.selectedEntityIds = ngModel.$viewValue.map(getLeafEntityId);
          };
        }
      };
    }
  ]);

  angular.module('atex.onecms.ui.widgets').registerDirective('pMetadataXTagDimension', function(MetadataService, $compile, $timeout) {
    return {
      require: '^ngModel',
      priority: 1, // Needed since we're using x-ng-model on the same element

      scope: {
        model: '=ngModel',
        dimensionInfo: '=dimensionInfo',
        'config' : '='
      },

      controller: function($scope) {
        $scope.resolvedEntities = [];
        $scope.knownContentBackedEntities = [];

        $scope.destroyed = false;

        $scope.moveEntity = function(oldIndex, newIndex) {
              $scope.model.splice(newIndex, 0, $scope.model.splice(oldIndex, 1)[0]);
          };

      },

      link: function(scope, element, attr, ngModel) {
        var dimensionId = attr.dimensionId;
        var dimName = attr.dimensionname;
        var enumerable = scope.$eval(attr.enumerable) !== false; // default value: true
        var editable = scope.$eval(attr.editable) !== false; // default value: true
        var autoCompletion = scope.$eval(attr.autoCompletion) !== false; // default value: true
        var exclude = scope.$eval(attr.exclude);

        var entityResolvePromises = {};

        var getContentBackedEntity = function(entity) {
          return findEntityByPath(scope.knownContentBackedEntities, entityToPathArray(entity));
        };

        var isSearchTermOK = function(term) {
          return term.split(/\//).every(function(part) { return part.trim().length >= 2; }) &&
            typeof _.find(term.split(/\s+/), function(s) { return s.trim().length >= 2; }) !== 'undefined';
        };

        element.select2({
          tags: function() {
            return [];
          },

          separator: '|',
          tokenSeparators: enumerable === true ? undefined : [","],
          containerCss: { "width": "100%" },
          containerCssClass: "metadata-tags",
          selectOnBlur: true,
          placeholder: dimName,

          formatNoMatches: function(term) {
            return !isSearchTermOK(term) ? 'Please enter 2 or more characters' : 'No matches found';
          },

          formatSelection: function(object, container) {
            var entityPath = entityToPath(object);
            var contentBackedEntity = getContentBackedEntity(object);

            if (typeof contentBackedEntity !== "undefined") {
              var element = $('<span>').text(entityPath);

              container.append(element);
              container.parent().addClass('has-extra-information');

              var html = buildAttributesPopoverContent(contentBackedEntity.id,
                                                       contentBackedEntity.attributes);

              element.attr('data-content', html);
              element.attr('data-html', 'true');
              element.attr('x-placement', 'auto');
              element.attr('x-popover', '');

              $timeout(function() {
                $compile(container.contents())(scope);
              });
            } else {
              return entityPath;
            }
          },

          formatResult: function(entity, container, query) {
            var entityPath = entityToPath(entity);
            var split = _.uniq(query.term.trim().replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&").split(/\s+|\//));

            var regex = _.sortBy(split, function(s) { return -s.length; }).join('|');

            var lastIndexOfSlash = entityPath.lastIndexOf('/');

            var leafString = lastIndexOfSlash === -1 ? entityPath : entityPath.substring(lastIndexOfSlash + 1);
            leafString = leafString.replace(new RegExp(regex, 'ig'), '<strong>$&</strong>');

            return lastIndexOfSlash === -1 ? leafString : (entityPath.substring(0, lastIndexOfSlash + 1) + leafString);
          },

          createSearchChoice: function(term) {
            if((exclude) && (exclude.indexOf(dimensionId)>-1)) {
              return null;
            }

            return enumerable === false ? entityFromPath(term) : null;
          },

          query: _.debounce(function(options) {
            if (autoCompletion === true && isSearchTermOK(options.term) && options.term.length > 1) {
              MetadataService.getSuggestions({
                dimensionId: dimensionId,
                entityString: options.term
              }).then(function(result) {
                var entities = result.data.entities.map(function(entity) {
                  cleanEntity(entity);
                  return entity;
                });

                options.callback({ more: false, results: entities });
              }).then(undefined, function(error) {
                console.log('Error while autocompleting in dimension ' + dimensionId + '!', error);

                options.callback({ more: false, results: [] });
              });
            } else {
              options.callback({ more: false, results: [] });
            }
          }, 200),

          id: function(object) {
            return entityToPath(object);
          }
        });

        // The input field is difficult to focus on tablets. This is a fix.
        element.select2('container').find('.select2-choices').click(function() {
          $('.select2-search-field input', this).focus();
          var focusedElement = $(this).find('.select2-search-choice-focus .popover-trigger');

          if (focusedElement.length === 0) {
            closeVisiblePopovers();
          } else {
            var popoverInstance = focusedElement.data("bs.popover");
            var toRemainOpen = popoverInstance.$tip ? popoverInstance.$tip.attr("id") : "";
            closeVisiblePopovers(toRemainOpen);
          }
        });

        if (!editable) {
          element.select2('readonly', true);
        }

          if (editable) {
              scope.sorter = sortable.create($('ul.select2-choices')[0], {
                  onUpdate: function(event) {
                      scope.$apply(function() {
                          scope.moveEntity(event.oldIndex, event.newIndex);
                      });
                  }
              });
          }

        var lookupEntityAttributesFor = function(entity) {
          var entityPath = entityToPath(entity);

          var resolvedEntity = _.find(scope.resolvedEntities, function(resolvedEntity) {
            return entityToPath(resolvedEntity) === entityPath;
          });

          if (typeof resolvedEntity !== 'undefined' || typeof entityResolvePromises[entityPath] !== 'undefined') {
            return;
          }

          var requestEntities = [ entityFromPath(entityPath) ];

          var resolvePromise = MetadataService.lookupContentBackedEntities({
            data: {
              dimensions: [
                {
                  id: dimensionId,
                  entities: requestEntities
                }
              ]
            }
          });

          entityResolvePromises[entityPath] = resolvePromise;

          resolvePromise.then(function(responseInfo) {
            if (scope.destroyed === true) {
              return;
            }

            scope.resolvedEntities.push(requestEntities[0]);

            entityResolvePromises[entityPath] = undefined;

            var responseDimensions = responseInfo.data.dimensions;
            var responseDimension = _.find(responseDimensions, function(dimension) { return dimension.id === dimensionId; });

            var responseEntity = _.find(responseDimension.entities, function(entity) { return entityToPath(entity) === entityPath });

            if (typeof responseEntity !== 'undefined') {
              scope.knownContentBackedEntities.push(responseEntity);
              ngModel.$render();
            }
          }).then(undefined, function(error) {
            console.log('Error while resolving metadata!', error);
            entityResolvePromises[entityPath] = undefined;
          });
        };

        scope.$watch('model', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            closeVisiblePopovers();

            if (newValue.length > oldValue.length) {
              lookupEntityAttributesFor(newValue[newValue.length - 1]);
            }
          }
        }, true);

        scope.$watch('dimensionInfo', function(newValue, oldValue) {
          if (newValue !== oldValue) {
            var resolvedEntities = newValue.resolvedEntities || [];
            var knownContentBackedEntities = newValue.knownContentBackedEntities || [];

            if (resolvedEntities.length > 0 || knownContentBackedEntities.length > 0) {
              scope.resolvedEntities = scope.resolvedEntities.concat(resolvedEntities);
              scope.knownContentBackedEntities = scope.knownContentBackedEntities.concat(knownContentBackedEntities);

              ngModel.$render();
            }
          }
        });

        ngModel.$render = function(value) {
          element.select2('data', ngModel.$viewValue);
        };

        element.on('select2-removing', function(event) {
          closeVisiblePopovers();
        });

        element.on('change', function(event) {
          closeVisiblePopovers();

          var addedEntity = atex.onecms.ObjectUtils.getByPath(event || {}, ['added']);

          if (typeof addedEntity !== 'undefined') {
            lookupEntityAttributesFor(addedEntity);
          }

          scope.$apply(function() {
            ngModel.$setViewValue(element.select2('data'));
          });
        });

        scope.$on('$destroy', function() {
          scope.destroyed = true;
        });
      }
    };
  });

  return ['$q', '$timeout', 'MetadataService', 'ContentService', '$http','$location',
  function($q, $timeout, MetadataService, ContentService, $http, $location) {
    return {
      replace: false,
      restrict: 'AE',

      scope: {
        'config': '=',
        'baseUrl': '@',
        'domainObject': '=',
        'domainObjects': '=',
        'widgetId': '@',
        'mode': '@'
      },

      templateUrl: atex.onecms.baseUrl + '/template.html',

      controller: function($scope) {
        $scope.select2BaseUrl = '/onecms/polopoly_fs/atex.onecms.Widget-pBaseSelect2!';

        var collectTextForSuggestion = function() {
          var texts = [];

          if (typeof $scope.config !== 'undefined') {
            ($scope.config.textsToAnnotate || []).forEach(function(textSourceName) {
              var domainObject = $scope.domainObjects[textSourceName];

              if (typeof domainObject !== 'undefined') {
                texts.push(domainObject.getData() || '');
              }
            });
          }

          return texts.join('\n');
        };

        $scope.domainObject = $scope.domainObject || $scope.domainObjects['data'];

        $scope.lookupFields = $scope.config.lookupFields;
        $scope.toggle = $scope.config.toggle === true;
        $scope.editing = false;
        $scope.toggleEdit = function() {
          $scope.editing = !$scope.editing;
        };
        $scope.exclude = $scope.config.exclude;

        $scope.editMode = ($scope.mode === 'edit');
        $scope.editable = ($scope.config.editable !== false) && $scope.editMode; // default config value: true
        $scope.autoCompletion = $scope.config.autoCompletion !== false; // default value: true
        $scope.annotation = $scope.config.annotation === true; // default value: false
        $scope.leafOnly = $scope.config.leafOnly === true;
        $scope.maximumSelectionSize = $scope.config.maximumSelectionSize || 0;

        $scope.treePreloadDepth = parseInt($scope.config.treePreloadDepth) || 1; // default value: 1
        $scope.treeMaxHeight = parseInt($scope.config.treeMaxHeight) || 500; // default value: 500

        $scope.extraDimensions =  $scope.config.extraDimensions || [];

        $scope.dimensionInfos = [];

        $scope.loading = true;
        $scope.touch = false;

        $scope.annotationError = false;
        $scope.annotationInProgress = false;

        $scope.isLookup = function(name){
          return $scope.lookupFields !== undefined ? $scope.lookupFields.indexOf(name) > -1 : false;
        };

        $scope.onItemRemoved = function(item,dimensionInfo) {

          if (!dimensionInfo.lookups.filter(function (e) {
            return e.name === item.name
          }).length > 0) {
            dimensionInfo.lookups.push(item);
          }

          //sort the results
          dimensionInfo.lookups = dimensionInfo.lookups.sort(function (a, b) {
            return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
          });

          if (dimensionInfo.model.length === 0) {
            dimensionInfo.model.push(dimensionInfo.lookups[0]);
          }
        };

        $scope.onItemSelected = function(item,dimensionInfo) {

          if (dimensionInfo.model.length > 1) {
            dimensionInfo.model = dimensionInfo.model.slice(1);
          }
        };


        $scope.annotate = function() {
          $scope.annotationInProgress = true;
          $scope.annotationError = false;

          var annotationString = collectTextForSuggestion();

          var annotationPromises = $scope.domainObject.getTaxonomyIds().map(function(taxonomyId) {
            return MetadataService.annotate({ taxonomyId: taxonomyId, annotationString: annotationString });
          });

          $q.all(annotationPromises).then(function(annotationResults) {
            if ($scope.loading === true || $scope.destroyed === true) {
              $scope.annotationInProgress = false;

              return;
            }

            annotationResults.forEach(function(annotationResult) {
              var hits = annotationResult.data.hits || [];

              hits.forEach(function(hit) {
                var dimensionInfo = _.find($scope.dimensionInfos, function(dimensionInfo) {
                  return dimensionInfo.dimension.id === hit.dimension.id;
                });

                if (typeof dimensionInfo !== 'undefined') {
                  var existingEntities = dimensionInfo.model;

                  hit.dimension.entities.forEach(function(hitEntity) {
                    var existingEntity = _.find(existingEntities, function(dimensionEntity) {
                      return entityToPath(dimensionEntity) === entityToPath(hitEntity);
                    });

                    if (typeof existingEntity === 'undefined') {
                      cleanEntity(hitEntity);
                      existingEntities.push(hitEntity);
                    }
                  });
                }
              });
            });

            $scope.lookupEntities();
            $scope.annotationInProgress = false;
          }).then(undefined, function(error) {
            if ($scope.loading === true || $scope.destroyed === true) {
              $scope.annotationInProgress = false;

              return;
            }

            console.log('Error while annotating content against server!', error);

            $scope.annotationError = true;
            $scope.annotationInProgress = false;
          });
        };

          $scope.clear = function() {
              $scope.dimensionInfos.forEach(function(dimension) {
                  dimension.model = [];
              });
          };

        $scope.isDimensionRequired = function (dimensionInfo) {

          if (typeof $scope.config.dimensions !== "undefined") {
              var existingObject = _.find($scope.config.dimensions, function(dimensionId) { return dimensionInfo.dimension.id === dimensionId});
              return (typeof existingObject !== 'undefined');
          }

          return true;

        }

        $scope.lookupEntities = function() {
          var lookupDimensionData = $scope.dimensionInfos.map(function(dimensionInfo) {
            return JSON.parse(JSON.stringify(_.extend({}, dimensionInfo.dimension, { entities: dimensionInfo.model })));
          });

          var transferInfo = {
            data: {
              dimensions: lookupDimensionData
            }
          };

          MetadataService.lookupContentBackedEntities(transferInfo).then(function(resultInfo) {
            if ($scope.loading === true || $scope.destroyed === true) {
              return;
            }

            $scope.dimensionInfos.forEach(function(dimensionInfo) {
              var requestDimension = _.find(lookupDimensionData, function(dimension) { return dimension.id === dimensionInfo.dimension.id; });
              var resolvedEntities = (typeof requestDimension !== 'undefined') ? requestDimension.entities : [];

              var responseDimension = _.find(resultInfo.data.dimensions, function(dimension) { return dimension.id === dimensionInfo.dimension.id; });
              var knownContentBackedEntities = (typeof responseDimension !== 'undefined') ? responseDimension.entities : [];

              dimensionInfo.entityResolveInfo = { resolvedEntities: resolvedEntities, knownContentBackedEntities: knownContentBackedEntities };
            });
          }).then(undefined, function(error) {
            console.log('Error while resolving metadata!', error);
          });
        };
      },

      link: function(scope, element, attrs) {
        angular.element('body').one('touchstart', function() {
          scope.$apply(function() {
            scope.touch = true;
          });
        });

        var findDimensionIndex = function(dimensionId, metadata) {
          metadata.dimensions = metadata.dimensions || [];

          var dimension = _.findWhere(metadata.dimensions, { id: dimensionId });

          if (typeof dimension !== 'undefined') {
            return metadata.dimensions.indexOf(dimension);
          }

          return -1;
        };

        var cleanEntityTypeInformation = function(entityContainer) {
          delete entityContainer['entities_element_types'];

          (entityContainer.entities || []).forEach(cleanEntityTypeInformation);
        };

        var alignWithContentCategorization = function (metadata, dimensionId) {
          var _metadata = scope.domainObject.getMetadata();

          var _dimension = _.find(_metadata.dimensions, function (dimension) {
            return dimension.id === dimensionId;
          });

          if (_dimension) {
            var dimension = _.find(metadata.dimensions, function (dimension) {
              return dimension.id === dimensionId;
            });

            if (dimension) {
              _.extend(_.find(metadata.dimensions, function (dimension) {
                return dimension.id === dimensionId
              }), _dimension);
            } else {
              metadata.dimensions.push({
                id: dimensionId,
                localizations: {},
                name: dimensionId,
                entities: _dimension.entities
              });
            }
          } else {
            metadata.dimensions = _.without(metadata.dimensions, _.findWhere(metadata.dimensions, {
              id: dimensionId
            }));
          }

          return metadata;
        };

        var initialize = function() {
          scope.loading = true;
          scope.annotationError = false;
          scope.editing = false;

          if (typeof scope.watchFinalizer !== 'undefined') {
            scope.watchFinalizer();
          }

          var metadata = scope.domainObject.getMetadata();
          var taxonomyIds = scope.config.taxonomyIds || scope.domainObject.getTaxonomyIds();

          var taxonomyPromises = taxonomyIds.map(function(taxonomyId) {
            return ContentService.getContent({ id: taxonomyId }).then(function(responseInfo) {

              var externalIdAlias = atex.onecms.ObjectUtils.getByPath(responseInfo, 'data/aspects/atex.Aliases/data/aliases/externalId');

              if (typeof externalIdAlias === 'undefined') {
                var message = "Taxonomy with ID '" + taxonomyId + "' does not have an external content ID, and is thus not usable as a taxonomy!";

                console.warn(message);

                return $q.reject(atex.onecms.error.Error({
                  origin: 'pMetadataX',

                  type: atex.onecms.error.types.INVALID_PARAMETERS,
                  severity: atex.onecms.error.severities.CRITICAL,

                  cause: message
                }));
              }

              return MetadataService.getStructure({ id: externalIdAlias });
            });
          });

          var dimensionInfos = [];

          var additionalPromises = [];

          $q.allSettled(taxonomyPromises).then(function(settledResults) {
            var fulfilled = _.filter(settledResults, function(result) { return result.state === 'fulfilled'; }).map(function(result) { return result.value; });
            var rejected = _.filter(settledResults, function(result) { return result.state === 'rejected'; }).map(function(result) { return result.reason; });

            scope.numberOfMissingTaxonomies = rejected.length;
            scope.missingTaxonomies = _.map(rejected, function(reject) { return "'" + reject.rootCause.transferInfo.id + "'" }).join(", ");

            fulfilled.forEach(function(taxonomy) {
              taxonomy.data.dimensions.forEach(function(dimension) {
                var existingObject = _.find(scope.dimensionInfos, function(dimensionInfo) { return dimensionInfo.dimension.id === dimension.id; });

                var dimensionInfo = existingObject || { dimension: JSON.parse(JSON.stringify(dimension)) };
                dimensionInfo.lookups =[];
                dimensionInfos.push(dimensionInfo);
              });
            });

            dimensionInfos = _.uniq(dimensionInfos, false, function(dimensionInfo) { return dimensionInfo.dimension.id });

            dimensionInfos.forEach(function(dimensionInfo) {
              var dimensionIndex = findDimensionIndex(dimensionInfo.dimension.id, metadata);

              if (dimensionIndex === -1) {
                dimensionIndex = metadata.dimensions.push(dimensionInfo.dimension) - 1;
              }

              dimensionInfo.dimensionIndex = dimensionIndex;
              dimensionInfo.model = atex.onecms.ObjectUtils.getByPath(metadata, ['dimensions', dimensionIndex + '', 'entities']);

              var promise = scope.addDimensionLookups(dimensionInfo);
              if (promise) {
                  additionalPromises.push (promise);
              }
            });
            $q.allSettled(additionalPromises).then (function ()
              {
                var modified = false;
                dimensionInfos.forEach(function(dimensionInfo) {
                  if (dimensionInfo.lookups.length > 0 && dimensionInfo.dimension.entities.length === 0) {
                    metadata.dimensions.forEach(function (dimension) {
                      if (dimensionInfo.dimension.id === dimension.id && dimension.entities.length == 0) {
                        dimension.entities.push(dimensionInfo.lookups[0]);
                        modified = true;
                        dimensionInfo.dimension.entities = dimension.entities;
                        dimensionInfo.model = dimension.entities;
                        var dimensionIndex = findDimensionIndex(dimensionInfo.dimension.id, metadata);
                        metadata.dimensions[dimensionIndex].entities = dimension.entities;
                      }
                    });


                  }

                });
                if (modified) {
                  scope.domainObject.setMetadata(metadata);
                  scope.domainObject.changed();
                }
                dimensionInfos.forEach(function(dimensionInfo) {
                    (function (dimensionInfo) {
                        dimensionInfo.watchFinalizer = scope.$watch('dimensionInfos[' + dimensionInfos.indexOf(dimensionInfo) + '].model', function (newValue, oldValue) {
                            if (newValue !== oldValue && _.isArray(newValue)) {
                                _.each(scope.extraDimensions,function(dimension) {
                                    metadata = alignWithContentCategorization(metadata, dimension);
                                });
                                metadata.dimensions[dimensionInfo.dimensionIndex].entities = newValue;

                                // This is a short-term fix for an issue with collection type information in combination
                                // with the Polopoly 10.12 Content API. The real fix would be that dimension entities
                                // should have an actual domain object handling the list data.
                                cleanEntityTypeInformation(metadata.dimensions[dimensionInfo.dimensionIndex]);
                                $timeout(function () {
                                    scope.domainObject.setMetadata(metadata);
                                    scope.domainObject.changed();
                                });
                            }
                        }, true);
                    })(dimensionInfo);
                });

                scope.watchFinalizer = function() {
                    scope.dimensionInfos.forEach(function(dimensionInfo) {
                        dimensionInfo.watchFinalizer();
                    });
                };

                scope.dimensionInfos = dimensionInfos;
                scope.loading = false;

                scope.lookupEntities();

              });


          });
        };

        var updateDimensions = function () {
            scope.loading = true;
            scope.annotationError = false;
            scope.editing = false;

            var dimensions = scope.domainObject.getMetadata().dimensions;

            scope.dimensionInfos.forEach(function (dimensionInfo) {
                dimensions.forEach(function (dimension) {
                    if (dimensionInfo.dimension.id === dimension.id) {
                      if (dimension.entities.length === 0 && dimensionInfo.hasOwnProperty("lookups") && dimensionInfo.lookups.length > 0)
                      {} else {
                        dimensionInfo.dimension.entities = dimension.entities;
                        dimensionInfo.model = dimension.entities;
                      }
                    }
                });
            });

            scope.loading = false;
        };

        scope.addDimensionLookups = function (dimensionInfo) {

            if (scope.lookupFields !== undefined && scope.lookupFields.indexOf(dimensionInfo.dimension.name) > -1) {

                return $http.get($location.protocol()+'://'+$location.host()+':'+$location.port()+'/onecms/metadata-config/lookup/'+
                    (dimensionInfo.dimension.id === 'dimension.DeskFolders'? dimensionInfo.dimension.id : "dimension") + "/" + dimensionInfo.dimension.id).then(function(res){
                         res.data.map(function (result) {
                            if (dimensionInfo.model !== undefined && !dimensionInfo.model.filter(function (selectedValue) {
                                    return selectedValue.name === result.name }).length > 0) {
                                if (!dimensionInfo.lookups.filter(function (e) {
                                        return e.name === result.name
                                    }).length > 0) {
                                    dimensionInfo.lookups.push({
                                        id: result.name,
                                        childrenOmitted: false,
                                        localizations: {},
                                        name: result.name,
                                        entities: [],
                                        attributes: []
                                    });
                                }

                            }

                        });
                    });
            }
            return false;
        }

        scope.domainChangeFinalizer = scope.domainObject.on('onecms:changed', function(event, modifierId) {
          if (modifierId !== scope.widgetId) {
            updateDimensions();
          }
        });

        scope.$on('$destroy', function() {
          if (typeof scope.domainChangeFinalizer !== 'undefined') {
            scope.domainChangeFinalizer();
          }

          scope.destroyed = true;
        });

        //$timeout(function() {
          initialize();
        //});
      }
    };
  }];
});
