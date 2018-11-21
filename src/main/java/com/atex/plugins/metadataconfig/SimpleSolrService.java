package com.atex.plugins.metadataconfig;

import com.polopoly.search.solr.SolrServerUrl;
import org.apache.solr.client.solrj.SolrQuery;
import org.apache.solr.client.solrj.SolrServerException;
import org.apache.solr.client.solrj.impl.HttpSolrServer;
import org.apache.solr.client.solrj.response.QueryResponse;

public class SimpleSolrService {

    private final String baseUrl;
    private final HttpSolrServer solrServer;

    public SimpleSolrService(SolrServerUrl solrServerUrl, String core) {
        String separator = solrServerUrl.getUrl().endsWith("/") ? "" : "/";
        baseUrl = solrServerUrl.getUrl() + separator + core;
        solrServer = new HttpSolrServer(baseUrl);
    }

    public QueryResponse query(SolrQuery q) throws SolrServerException {
        return solrServer.query(q);
    }
}
