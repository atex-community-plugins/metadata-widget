package com.atex.plugins.metadataconfig;

import com.atex.onecms.app.dam.solr.SolrUtils;
import com.atex.onecms.app.dam.standard.aspects.DamFolderAspectBean;
import com.atex.onecms.content.*;
import com.atex.onecms.ws.service.ContextParams;
import com.atex.onecms.ws.service.ErrorResponseException;
import com.atex.onecms.ws.service.WebServiceUtil;
import com.google.gson.Gson;
import com.polopoly.cm.ExternalContentId;
import com.polopoly.cm.app.search.categorization.dimension.TagCategoryPolicy;
import com.polopoly.cm.client.CMException;
import com.polopoly.cm.policy.Policy;
import com.polopoly.cm.policy.PolicyCMServer;
import com.polopoly.metadata.Entity;
import com.polopoly.search.solr.PostFilteredSolrSearchClient;
import com.polopoly.search.solr.SearchClient;
import com.polopoly.search.solr.SearchResult;
import com.polopoly.search.solr.SearchResultPage;
import com.polopoly.search.solr.querydecorators.WithSecurityParent;
import com.sun.jersey.spi.resource.PerRequest;
import org.apache.log4j.Logger;
import org.apache.solr.client.solrj.SolrQuery;
import org.apache.solr.client.solrj.SolrServerException;
import org.apache.solr.client.solrj.response.QueryResponse;
import org.apache.solr.common.SolrDocument;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.http.HttpServlet;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.HttpHeaders;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.UriInfo;
import java.util.*;

@Path("/")
@PerRequest
public class MetadataConfigurationServlet extends HttpServlet {

    private static final Logger LOGGER = Logger.getLogger(MetadataConfigurationServlet.class.getName());
    private ContextParams contextParams;
    private SimpleSolrService solrService;
    private SearchClient searchClient;
    @Context
    WebServiceUtil webServiceUtil;

    public MetadataConfigurationServlet(@Context ServletContext servletContext, @Context ServletConfig servletConfig, @Context HttpHeaders httpHeaders, @Context UriInfo uriInfo) {
        contextParams = new ContextParams(servletContext, servletConfig, httpHeaders, uriInfo);

        try {
            searchClient = (SearchClient) contextParams.getApplication().getApplicationComponent(PostFilteredSolrSearchClient.DEFAULT_COMPOUND_NAME);

            solrService = new SimpleSolrService(SolrUtils.getSolrServerUrl(), SolrUtils.getCore());

        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    @GET
    @Path("lookup/{type}/{name}")
    @Produces(MediaType.APPLICATION_JSON)
    public String getLookup(@PathParam("type") String fieldType, @PathParam("name") String fieldName) throws Exception {

        Gson gson = new Gson();
        List<Entity> lookupValues = new ArrayList();

        switch (fieldType) {
            case "dimension.DeskFolders": {
                lookupValues = getFolderLookup(lookupValues);
                break;
            }
            case "dimension": {
                lookupValues = getDimensionEntities(fieldName);
                break;
            }
            default: {
                //return empty list if nothing fieldType was not matched
                break;
            }

        }

        return gson.toJson(lookupValues);
    }

    protected List<Entity> getDimensionEntities(String dimensionId) throws Exception {

        com.polopoly.cm.ContentId contentId = new ExternalContentId(dimensionId);
        Policy policy = getCMServer().getPolicy(contentId);
        List<Entity> lookups = new ArrayList<>();
        if (policy instanceof TagCategoryPolicy) {
            TagCategoryPolicy tagCategoryPolicy = (TagCategoryPolicy) policy;
            String latestTags = tagCategoryPolicy.getComponent("polopoly.ContentLists", "latestTags");
            if (latestTags != null && latestTags.length() > 0) {
                String[] names = tagCategoryPolicy.getContentReferenceNames(latestTags);
                Map<Integer,com.polopoly.cm.ContentId> map = new TreeMap<>();
                for (String name : names) {
                    com.polopoly.cm.ContentId contentReference = tagCategoryPolicy.getContentReference(latestTags, name);
                    if (contentReference != null) {
                        try {
                            Integer index = Integer.parseInt(name);
                            map.put(index,contentReference);
                        } catch (NumberFormatException e) {
                            LOGGER.debug("Invalid index "+name,e);
                        }
                    }
                }
                for (Integer key : map.keySet()) {
                    com.polopoly.cm.ContentId resultContentId = map.get(key);
                    addContentIdIntoLookup(lookups, resultContentId);
                }
            } else {
                SolrQuery q = new SolrQuery("*:*");
                q = new WithSecurityParent(policy.getContentId()).decorate(q);
                SearchResult response = searchClient.search(q,255);


                Iterator<SearchResultPage> iterator = response.iterator();
                while (iterator.hasNext()) {
                    SearchResultPage docList = iterator.next();
                    for (com.polopoly.cm.ContentId contentResultId : docList.getHits()) {
                        addContentIdIntoLookup(lookups, contentResultId);
                    }
                }
            }
        }

        return lookups;
    }

    protected void addContentIdIntoLookup(List<Entity> lookups, com.polopoly.cm.ContentId resultContentId) throws CMException, ErrorResponseException {
        Policy resultPolicy = getCMServer().getPolicy(resultContentId);
        lookups.add(makeEntity(resultPolicy));
    }

    protected Entity makeEntity(Policy resultPolicy) throws CMException {
        return new Entity(resultPolicy.getContent().getComponent("polopoly.Content", "name"), resultPolicy.getContent().getComponent("polopoly.Content", "name"));
    }

    protected List<Entity> getFolderLookup(List<Entity> lookups) throws SolrServerException, Exception {

        final ContentManager contentManager = getContentManager();
        SolrQuery q = new SolrQuery("+atex_desk_objectType:(folder)");
        q.add("variant", "list");
        q.add("fl", "id");
        q.addSort("name_atex_desk_ss", SolrQuery.ORDER.asc);

        int pageNum = 1;
        int itemsPerPage = 10;
        boolean done = false;

        while (!done) {
            q.setStart((pageNum - 1) * itemsPerPage);
            q.setRows(itemsPerPage);

            QueryResponse response = solrService.query(q);

            for (SolrDocument doc : response.getResults()) {
                String id = (String) doc.getFieldValue("id");
                ContentId contentId = IdUtil.fromString(id);
                ContentVersionId versionId = contentManager.resolve(contentId, Subject.NOBODY_CALLER);
                ContentResult<DamFolderAspectBean> result = contentManager.get(versionId, DamFolderAspectBean.class, Subject.NOBODY_CALLER);
                String name = result.getContent().getContentData().getName();
                lookups.add(new Entity(id, name));
            }

            pageNum++;

            if (response.getResults().size() < 1) {
                done = true;
            }
        }

        return lookups;
    }

    protected PolicyCMServer getCMServer() throws ErrorResponseException {
        return contextParams.getPolicyCMServer();
    }

    protected ContentManager getContentManager() throws ErrorResponseException {
        return webServiceUtil.getContentManager();
    }
}