package com.atex.plugins.metadataconfig;

import com.polopoly.search.solr.SolrServerUrl;
import org.apache.log4j.Logger;
import org.apache.solr.client.solrj.SolrQuery;
import org.apache.solr.client.solrj.SolrServerException;
import org.apache.solr.client.solrj.response.QueryResponse;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

public class SimpleSolrService {

    private Logger log = Logger.getLogger(SimpleSolrService.class);

    private String baseUrl;
    private Object solrServer;

    public SimpleSolrService(SolrServerUrl solrServerUrl, String core) {
        String separator = solrServerUrl.getUrl().endsWith("/") ? "" : "/";
        baseUrl = solrServerUrl.getUrl() + separator + core;
        try {
            this.solrServer = Class.forName("org.apache.solr.client.solrj.impl.HttpSolrServer").getDeclaredConstructor(String.class).newInstance(baseUrl);
        } catch (ClassNotFoundException | InstantiationException | IllegalAccessException | NoSuchMethodException | InvocationTargetException e) {
            log.debug("old HttpSolrServer not found, will try to create new SolrClient");
        }
        if (this.solrServer == null) {
            try {
                this.solrServer = Class.forName("com.polopoly.search.solr.SolrClientUtils").getDeclaredMethod("createSolrClient", String.class).invoke(null, baseUrl);
            } catch (ClassNotFoundException | IllegalAccessException | NoSuchMethodException | InvocationTargetException e) {
                log.error("Could not create solrServer", e);
            }
        }
    }

    public QueryResponse query(SolrQuery q) throws SolrServerException {

        try {
            Method method = solrServer.getClass().getMethod("query", SolrQuery.class);

            return (QueryResponse)method.invoke(q);
        } catch (IllegalAccessException | InvocationTargetException | NoSuchMethodException e) {
            log.error("unable to run sol query, q="+q.toString(),e);
            return null;
        }
    }

}
