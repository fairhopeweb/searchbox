import type { DataField } from './types';

export function getErrorMessage(msg: string): string {
  return `SearchBase: ${msg}`;
}

export const errorMessages = {
  invalidIndex: getErrorMessage('Please provide a valid index.'),
  invalidURL: getErrorMessage('Please provide a valid url.'),
  invalidComponentId: getErrorMessage('Please provide component id.'),
  invalidDataField: getErrorMessage('Please provide data field.'),
  dataFieldAsArray: getErrorMessage(
    'Only components with `search` type supports the multiple data fields. Please define `dataField` as a string.'
  )
};

export const querySuggestionFields = ['key', 'key.autosuggest', 'key.search'];

export const queryTypes = {
  Search: 'search',
  Term: 'term',
  Geo: 'geo',
  Range: 'range'
};

export const queryFormats = {
  Or: 'or',
  And: 'and'
};

export const sortOptions = {
  Asc: 'asc',
  Desc: 'desc',
  Count: 'count'
};

export const withClickIds = (results: Array<Object> = []): Array<Object> =>
  results.map((result, index) => ({
    ...result,
    _click_id: index + 1
  }));

export const highlightResults = (result: Object): Object => {
  const data = { ...result };
  if (data.highlight) {
    Object.keys(data.highlight).forEach(highlightItem => {
      const highlightValue = data.highlight[highlightItem][0];
      data._source = { ...data._source, [highlightItem]: highlightValue };
    });
  }
  return data;
};

export const parseHits = (hits: Array<Object>): Array<Object> => {
  let results: Array<Object> = [];
  if (hits) {
    results = [...hits].map(item => {
      const data = highlightResults(item);
      const result = Object.keys(data)
        .filter(key => key !== '_source')
        .reduce(
          (obj: { [key: string]: any }, key: string) => {
            // eslint-disable-next-line
              obj[key] = data[key];
            return obj;
          },
          {
            ...data._source
          }
        );
      return result;
    });
  }
  return results;
};

export const getNormalizedField = (
  field: string | Array<string | DataField>
): Array<string> => {
  if (field) {
    // if data field is string
    if (!Array.isArray(field)) {
      return [field];
    }
    if (field.length) {
      let fields = [];
      field.forEach(dataField => {
        if (typeof dataField === 'string') {
          fields.push(dataField);
        } else if (dataField.field) {
          // if data field is an array of objects
          fields.push(dataField.field);
        }
      });
      return fields;
    }
  }
  return undefined;
};

export function isNumber(n) {
  return !Number.isNaN(parseFloat(n)) && Number.isFinite(n);
}

export const getNormalizedWeights = (
  field: string | Array<string | DataField>
): Array<string> => {
  if (field && Array.isArray(field) && field.length) {
    let weights = [];
    field.forEach(dataField => {
      if (isNumber(dataField.weight)) {
        // if data field is an array of objects
        weights.push(dataField.weight);
      } else {
        // Add default weight as 1 to maintain order
        weights.push(1);
      }
    });
    return weights;
  }
  return undefined;
};

export function flatReactProp(reactProp: Object, componentID): Array<string> {
  let flattenReact = [];
  const flatReact = react => {
    if (react && Object.keys(react)) {
      Object.keys(react).forEach(r => {
        if (react[r]) {
          if (typeof react[r] === 'string') {
            flattenReact = [...flattenReact, react[r]];
          } else if (Array.isArray(react[r])) {
            flattenReact = [...flattenReact, ...react[r]];
          } else if (typeof react[r] === 'object') {
            flatReact(react[r]);
          }
        }
      });
    }
  };
  flatReact(reactProp);
  // Remove cyclic dependencies i.e dependencies on it's own
  flattenReact = flattenReact.filter(react => react !== componentID);
  return flattenReact;
}
// flattens a nested array
export const flatten = (arr: Array<any>) =>
  arr.reduce(
    (flat, toFlatten): Array<any> =>
      flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten),
    []
  );

// helper function to extract suggestions
export const extractSuggestion = (val: any) => {
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return flatten(val);
    }
    return null;
  }
  return val;
};

/**
 *
 * @param {array} fields DataFields passed on Search Components
 * @param {array} suggestions Raw Suggestions received from ES
 * @param {string} currentValue Search Term
 * @param {boolean} showDistinctSuggestions When set to true will only return 1 suggestion per document
 */
export const getSuggestions = (
  fields: Array<string> = [],
  suggestions: Array<Object>,
  currentValue: string = '',
  showDistinctSuggestions: boolean = true
) => {
  let suggestionsList = [];
  let labelsList = [];
  let skipWordMatch = false; //  Use to skip the word match logic, important for synonym

  const populateSuggestionsList = (val, parsedSource, source) => {
    // check if the suggestion includes the current value
    // and not already included in other suggestions
    const isWordMatch =
      skipWordMatch ||
      currentValue
        .trim()
        .split(' ')
        .some(term =>
          String(val)
            .toLowerCase()
            .includes(term)
        );
    // promoted results should always include in suggestions even there is no match
    if ((isWordMatch && !labelsList.includes(val)) || source._promoted) {
      const defaultOption = {
        label: val,
        value: val,
        source
      };
      const option = {
        ...defaultOption
      };
      labelsList = [...labelsList, val];
      suggestionsList = [...suggestionsList, option];

      if (showDistinctSuggestions) {
        return true;
      }
    }

    return false;
  };

  const parseField = (parsedSource, field = '', source = parsedSource) => {
    if (typeof parsedSource === 'object') {
      const fieldNodes = field.split('.');
      const label = parsedSource[fieldNodes[0]];
      if (label) {
        if (fieldNodes.length > 1) {
          // nested fields of the 'foo.bar.zoo' variety
          const children = field.substring(fieldNodes[0].length + 1);
          if (Array.isArray(label)) {
            label.forEach(arrayItem => {
              parseField(arrayItem, children, source);
            });
          } else {
            parseField(label, children, source);
          }
        } else {
          const val = extractSuggestion(label);
          if (val) {
            if (Array.isArray(val)) {
              if (showDistinctSuggestions) {
                return val.some(suggestion =>
                  populateSuggestionsList(suggestion, parsedSource, source)
                );
              }
              val.forEach(suggestion =>
                populateSuggestionsList(suggestion, parsedSource, source)
              );
            }
            return populateSuggestionsList(val, parsedSource, source);
          }
        }
      }
    }
    return false;
  };

  const traverseSuggestions = () => {
    if (showDistinctSuggestions) {
      suggestions.forEach(item => {
        fields.some(field => parseField(item, field));
      });
    } else {
      suggestions.forEach(item => {
        fields.forEach(field => {
          parseField(item, field);
        });
      });
    }
  };

  traverseSuggestions();

  if (suggestionsList.length < suggestions.length && !skipWordMatch) {
    /*
			When we have synonym we set skipWordMatch to false as it may discard
			the suggestion if word doesnt match term.
			For eg: iphone, ios are synonyms and on searching iphone isWordMatch
			in  populateSuggestionList may discard ios source which decreases no.
			of items in suggestionsList
		*/
    skipWordMatch = true;
    traverseSuggestions();
  }

  return suggestionsList;
};

export function parseCompAggToHits(
  aggFieldName: string,
  buckets?: Array<Object> = []
): Array<Object> {
  return buckets.map(bucket => {
    // eslint-disable-next-line camelcase
    const { doc_count, key, [aggFieldName]: data } = bucket;
    return {
      _doc_count: doc_count,
      // To handle the aggregation results for term and composite aggs
      _key: key[aggFieldName] !== undefined ? key[aggFieldName] : key,
      ...data
    };
  });
}
