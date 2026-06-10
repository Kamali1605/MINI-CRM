/**
 * Converts a FilterRuleGroup DSL into a parameterised SQL WHERE clause.
 * The query always joins against an aggregated orders subquery so
 * per-customer fields are available.
 */
import { FilterRule, FilterRuleGroup, isFilterRuleGroup } from '../types';

interface SqlFragment {
  sql: string;
  params: unknown[];
}

const BASE_QUERY = `
  SELECT c.*
  FROM customers c
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(total), 0) AS total_spent,
      MAX(ordered_at) AS last_order_at,
      MIN(ordered_at) AS first_order_at,
      ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) AS categories
    FROM orders o
    WHERE o.customer_id = c.id
  ) agg ON true
`;

/**
 * Builds the full SELECT query for a segment's filter rules.
 */
export function buildSegmentQuery(rules: FilterRuleGroup): { sql: string; params: unknown[] } {
  if (rules.rules.length === 0) {
    return { sql: `${BASE_QUERY} LIMIT 10000`, params: [] };
  }

  const { sql: whereSql, params } = buildGroup(rules, []);
  return {
    sql: `${BASE_QUERY} WHERE ${whereSql} LIMIT 10000`,
    params,
  };
}

/**
 * Builds a count query for sizing segments quickly.
 */
export function buildSegmentCountQuery(rules: FilterRuleGroup): { sql: string; params: unknown[] } {
  if (rules.rules.length === 0) {
    return {
      sql: `SELECT COUNT(*) FROM customers c LEFT JOIN LATERAL (
        SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS total_spent,
               MAX(ordered_at) AS last_order_at, MIN(ordered_at) AS first_order_at,
               ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) AS categories
        FROM orders o WHERE o.customer_id = c.id
      ) agg ON true`,
      params: [],
    };
  }

  const { sql: whereSql, params } = buildGroup(rules, []);
  return {
    sql: `SELECT COUNT(*) FROM customers c
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS order_count, COALESCE(SUM(total),0) AS total_spent,
               MAX(ordered_at) AS last_order_at, MIN(ordered_at) AS first_order_at,
               ARRAY_AGG(DISTINCT category) FILTER (WHERE category IS NOT NULL) AS categories
        FROM orders o WHERE o.customer_id = c.id
      ) agg ON true
      WHERE ${whereSql}`,
    params,
  };
}

function buildGroup(group: FilterRuleGroup, params: unknown[]): SqlFragment {
  const parts: string[] = [];

  for (const rule of group.rules) {
    if (isFilterRuleGroup(rule)) {
      const child = buildGroup(rule, params);
      parts.push(`(${child.sql})`);
    } else {
      const frag = buildRule(rule, params);
      parts.push(frag.sql);
    }
  }

  const joiner = group.combinator === 'AND' ? ' AND ' : ' OR ';
  return { sql: parts.join(joiner), params };
}

function buildRule(rule: FilterRule, params: unknown[]): SqlFragment {
  const push = (val: unknown): string => {
    params.push(val);
    return `$${params.length}`;
  };

  const { field, operator, value } = rule;

  switch (field) {
    case 'total_spent':
      return numericRule('agg.total_spent', operator, value as number, params, push);

    case 'order_count':
      return numericRule('agg.order_count', operator, value as number, params, push);

    case 'days_since_last_order': {
      const days = Number(value);
      const placeholder = push(days);
      const op = operatorToSql(operator);
      // EXTRACT(epoch) diff in days
      return {
        sql: `EXTRACT(EPOCH FROM (now() - agg.last_order_at)) / 86400 ${op} ${placeholder}`,
        params,
      };
    }

    case 'days_since_first_order': {
      const days = Number(value);
      const placeholder = push(days);
      const op = operatorToSql(operator);
      return {
        sql: `EXTRACT(EPOCH FROM (now() - agg.first_order_at)) / 86400 ${op} ${placeholder}`,
        params,
      };
    }

    case 'city': {
      if (operator === 'eq') {
        const placeholder = push(String(value));
        return { sql: `LOWER(c.city) = LOWER(${placeholder})`, params };
      }
      if (operator === 'neq') {
        const placeholder = push(String(value));
        return { sql: `LOWER(c.city) != LOWER(${placeholder})`, params };
      }
      if (operator === 'contains') {
        const placeholder = push(`%${String(value).toLowerCase()}%`);
        return { sql: `LOWER(c.city) LIKE ${placeholder}`, params };
      }
      break;
    }

    case 'tags': {
      const tag = String(value);
      if (operator === 'includes') {
        const placeholder = push(tag);
        return { sql: `${placeholder} = ANY(c.tags)`, params };
      }
      if (operator === 'excludes') {
        const placeholder = push(tag);
        return { sql: `NOT (${placeholder} = ANY(c.tags))`, params };
      }
      break;
    }

    case 'category_purchased': {
      const cat = String(value);
      if (operator === 'includes') {
        const placeholder = push(cat);
        return { sql: `${placeholder} = ANY(agg.categories)`, params };
      }
      if (operator === 'excludes') {
        const placeholder = push(cat);
        return { sql: `(agg.categories IS NULL OR NOT (${placeholder} = ANY(agg.categories)))`, params };
      }
      break;
    }
  }

  // Fallback: always-true to avoid SQL errors on unknown fields
  console.warn(`[filter-engine] unhandled rule: ${field} ${operator} ${value}`);
  return { sql: 'TRUE', params };
}

function numericRule(
  col: string,
  operator: string,
  value: number,
  params: unknown[],
  push: (v: unknown) => string
): SqlFragment {
  const placeholder = push(Number(value));
  const op = operatorToSql(operator);
  return { sql: `${col} ${op} ${placeholder}`, params };
}

function operatorToSql(operator: string): string {
  const map: Record<string, string> = {
    eq: '=',
    neq: '!=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
  };
  return map[operator] ?? '=';
}
